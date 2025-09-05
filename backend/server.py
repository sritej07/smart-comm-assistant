from fastapi import FastAPI, APIRouter, HTTPException, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
import json
import asyncio
import google.generativeai as genai
import numpy as np
from sentence_transformers import SentenceTransformer
import faiss
import re
import uvicorn

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Initialize Gemini
genai.configure(api_key=os.environ['GEMINI_API_KEY'])
model = genai.GenerativeModel('gemini-2.0-flash-exp')

# Initialize embedding model and FAISS
embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
vector_dimension = 384  # all-MiniLM-L6-v2 dimension
faiss_index = faiss.IndexFlatIP(vector_dimension)  # Inner product for cosine similarity

# Knowledge base documents
knowledge_base = [
    {"id": "faq_01", "title": "Refund Policy", "content": "We offer full refunds within 30 days of purchase. To request a refund, contact support with your order ID."},
    {"id": "faq_02", "title": "Shipping Information", "content": "Standard shipping takes 3-5 business days. Express shipping is available for 1-2 day delivery."},
    {"id": "faq_03", "title": "Account Issues", "content": "If you're having trouble accessing your account, try resetting your password or contact support."},
    {"id": "policy_01", "title": "Privacy Policy", "content": "We protect your personal information and only use it to provide our services. We never share data with third parties."},
    {"id": "policy_02", "title": "Terms of Service", "content": "By using our service, you agree to our terms. Violations may result in account suspension."},
    {"id": "billing_01", "title": "Billing Support", "content": "For billing questions, contact our billing team with your order ID and payment method details."},
    {"id": "tech_01", "title": "Technical Support", "content": "For technical issues, please provide your device information, browser version, and steps to reproduce the issue."},
    {"id": "feature_01", "title": "Feature Requests", "content": "We welcome feature suggestions! Please describe your use case and how it would benefit other users."}
]

# Build FAISS index
def build_knowledge_base():
    global faiss_index
    texts = [doc["content"] for doc in knowledge_base]
    embeddings = embedding_model.encode(texts)
    embeddings = embeddings / np.linalg.norm(embeddings, axis=1, keepdims=True)  # Normalize
    faiss_index.add(embeddings.astype('float32'))

build_knowledge_base()

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# Models
class ExtractedData(BaseModel):
    phone: Optional[str] = None
    alt_email: Optional[str] = None
    order_id: Optional[str] = None
    requested_action: Optional[str] = None
    urgency_keywords: List[str] = []

class RetrievalHit(BaseModel):
    doc_id: str
    title: str
    snippet: str
    score: float

class DraftReply(BaseModel):
    text: str
    sources_used: List[str] = []
    confidence: float
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AuditLogEntry(BaseModel):
    event: str  # generated|edited|sent
    by: str     # user|system
    text: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Email(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sender: str
    sender_name: str
    subject: str
    body: str
    date_received: datetime
    raw_html: Optional[str] = None
    extracted: ExtractedData = Field(default_factory=ExtractedData)
    sentiment: str = "Neutral"  # Positive|Neutral|Negative
    priority_score: float = 0.0
    priority_rationale: List[str] = []
    retrieval_hits: List[RetrievalHit] = []
    draft_reply: Optional[DraftReply] = None
    audit_log: List[AuditLogEntry] = []
    status: str = "pending"  # pending|escalated|resolved
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class EmailSummary(BaseModel):
    id: str
    sender: str
    subject: str
    sentiment: str
    priority_score: float
    status: str
    preview: str
    date_received: datetime

class SendEmailRequest(BaseModel):
    final_text: str
    send_mode: str = "mock"

class AnalyticsResponse(BaseModel):
    total_emails: int
    pending_count: int
    resolved_count: int
    sentiment_breakdown: Dict[str, int]
    avg_priority: float

# Priority computation
def compute_priority_score(email_dict, vip_list=set()):
    urgency_keywords = ["immediately", "urgent", "asap", "cannot", "can't", "critical", "now", "blocked", "down", "emergency", "help"]
    
    subject_lower = email_dict["subject"].lower()
    body_lower = email_dict["body"].lower()
    
    urgency = 1.0 if any(k in subject_lower or k in body_lower for k in urgency_keywords) else 0.0
    
    sentiment_map = {"Negative": 1.0, "Neutral": 0.5, "Positive": 0.0}
    sentiment_score = sentiment_map.get(email_dict["sentiment"], 0.5)
    
    now = datetime.now(timezone.utc)
    date_received = email_dict["date_received"]
    if isinstance(date_received, str):
        date_received = datetime.fromisoformat(date_received.replace('Z', '+00:00'))
    
    delta_hours = (now - date_received).total_seconds() / 3600
    recency = 1.0 if delta_hours <= 1 else 0.5 if delta_hours <= 24 else 0.0
    
    vip_flag = 1.0 if email_dict["sender"] in vip_list else 0.0
    
    w_urgency, w_sentiment, w_recency, w_vip = 0.6, 0.25, 0.1, 0.05
    
    score = w_urgency * urgency + w_sentiment * sentiment_score + w_recency * recency + w_vip * vip_flag
    
    rationale = []
    if urgency > 0:
        rationale.append("urgency_keywords")
    if sentiment_score > 0.5:
        rationale.append("negative_sentiment")
    if recency > 0:
        rationale.append("recent_email")
    if vip_flag > 0:
        rationale.append("vip_sender")
    
    return round(score, 3), rationale

# Email extraction using Gemini
async def extract_email_info(email_body: str) -> ExtractedData:
    try:
        extraction_prompt = f"""SYSTEM: You are an extraction assistant. ONLY output valid JSON.

USER: Extract from the EMAIL_TEXT the following fields: phone, alt_email, requested_action, order_id, urgency_keywords. Output JSON:
{{
  "phone": null,
  "alt_email": null,
  "requested_action": "",
  "order_id": null,
  "urgency_keywords": []
}}
EMAIL_TEXT: \"\"\"{email_body}\"\"\""""

        response = await asyncio.to_thread(
            model.generate_content,
            extraction_prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.0,
                max_output_tokens=512
            )
        )
        
        result_text = response.text.strip()
        if result_text.startswith('```json'):
            result_text = result_text[7:]
        if result_text.endswith('```'):
            result_text = result_text[:-3]
        
        extracted_data = json.loads(result_text)
        return ExtractedData(**extracted_data)
    
    except Exception as e:
        logging.error(f"Gemini extraction failed: {e}")
        # Fallback regex extraction
        phone_match = re.search(r'(\+?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4})', email_body)
        email_match = re.search(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', email_body)
        order_match = re.search(r'order\s*#?\s*([A-Za-z0-9]+)', email_body, re.IGNORECASE)
        
        urgency_keywords = ["immediately", "urgent", "asap", "critical", "now", "blocked", "down"]
        found_urgency = [kw for kw in urgency_keywords if kw in email_body.lower()]
        
        return ExtractedData(
            phone=phone_match.group(1) if phone_match else None,
            alt_email=email_match.group(0) if email_match else None,
            requested_action="Customer inquiry - needs manual review",
            order_id=order_match.group(1) if order_match else None,
            urgency_keywords=found_urgency
        )

# Sentiment analysis using Gemini
async def analyze_sentiment(email_body: str) -> str:
    try:
        sentiment_prompt = f"""Analyze the sentiment of this email. Respond with only one word: Positive, Neutral, or Negative.

Email: {email_body}"""

        response = await asyncio.to_thread(
            model.generate_content,
            sentiment_prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.0,
                max_output_tokens=10
            )
        )
        
        sentiment = response.text.strip()
        if sentiment in ["Positive", "Neutral", "Negative"]:
            return sentiment
        return "Neutral"
    
    except Exception as e:
        logging.error(f"Sentiment analysis failed: {e}")
        # Simple fallback
        negative_words = ["angry", "frustrated", "terrible", "awful", "hate", "disappointed", "complaint"]
        positive_words = ["great", "excellent", "love", "amazing", "wonderful", "perfect", "thank"]
        
        email_lower = email_body.lower()
        if any(word in email_lower for word in negative_words):
            return "Negative"
        elif any(word in email_lower for word in positive_words):
            return "Positive"
        return "Neutral"

# RAG retrieval
def retrieve_relevant_docs(query: str, top_k: int = 3) -> List[RetrievalHit]:
    query_embedding = embedding_model.encode([query])
    query_embedding = query_embedding / np.linalg.norm(query_embedding, axis=1, keepdims=True)
    
    scores, indices = faiss_index.search(query_embedding.astype('float32'), top_k)
    
    hits = []
    for score, idx in zip(scores[0], indices[0]):
        if idx < len(knowledge_base):
            doc = knowledge_base[idx]
            hits.append(RetrievalHit(
                doc_id=doc["id"],
                title=doc["title"],
                snippet=doc["content"][:150] + "..." if len(doc["content"]) > 150 else doc["content"],
                score=float(score)
            ))
    
    return hits

# Generate reply using RAG + Gemini
async def generate_reply(email: Dict[str, Any], retrieval_hits: List[RetrievalHit]) -> DraftReply:
    try:
        context_docs = ""
        for i, hit in enumerate(retrieval_hits, 1):
            context_docs += f"{i}) id:{hit.doc_id} score:{hit.score:.2f} snippet:\"{hit.snippet}\"\n"
        
        reply_prompt = f"""SYSTEM: You are the professional ACME Support Assistant. Use only the CONTEXT DOCUMENTS for factual claims. Return JSON only:
{{
  "reply_text":"", "sources_used":[], "confidence":0.0, "suggested_action":"send|edit|escalate"
}}

USER: CONTEXT DOCUMENTS:
{context_docs}

EMAIL_SUBJECT: "{email['subject']}"
EMAIL_BODY: \"\"\"{email['body']}\"\"\"

METADATA:
- sender: {email['sender']}
- sentiment: {email['sentiment']}
- extracted: {json.dumps(email['extracted'])}
- priority_score: {email['priority_score']}

TASK: Generate a concise, professional reply (<= 180 words). If info missing, ask one clarifying question. If sentiment is Negative, include an empathetic line. Populate sources_used with doc ids used for facts."""

        response = await asyncio.to_thread(
            model.generate_content,
            reply_prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.0,
                max_output_tokens=512
            )
        )
        
        result_text = response.text.strip()
        if result_text.startswith('```json'):
            result_text = result_text[7:]
        if result_text.endswith('```'):
            result_text = result_text[:-3]
        
        reply_data = json.loads(result_text)
        
        return DraftReply(
            text=reply_data.get("reply_text", "Thank you for contacting us. We'll review your inquiry and respond soon."),
            sources_used=reply_data.get("sources_used", []),
            confidence=reply_data.get("confidence", 0.7)
        )
    
    except Exception as e:
        logging.error(f"Reply generation failed: {e}")
        sentiment_response = ""
        if email['sentiment'] == "Negative":
            sentiment_response = "I understand your frustration, and I sincerely apologize for any inconvenience. "
        
        return DraftReply(
            text=f"{sentiment_response}Thank you for reaching out to us. I've received your inquiry regarding '{email['subject']}' and will ensure it gets the proper attention it deserves. Our team will review the details and provide a comprehensive response shortly.",
            sources_used=[],
            confidence=0.5
        )

# API Routes
@api_router.get("/")
async def root():
    return {"message": "Smart Communication Assistant API", "status": "running"}

@api_router.post("/emails/ingest/mock")
async def ingest_mock_emails():
    # Sample realistic support emails
    sample_emails = [
        {
            "sender": "john.customer@email.com",
            "sender_name": "John Customer",
            "subject": "URGENT: Order #12345 not delivered - need immediate help",
            "body": "Hi, I placed order #12345 three weeks ago and still haven't received it. This is extremely urgent as it was a gift for my daughter's birthday which is tomorrow. I've tried calling but can't get through. My alternate email is john.backup@gmail.com and phone is +1-555-0123. Please help immediately!",
            "date_received": datetime.now(timezone.utc)
        },
        {
            "sender": "sarah.jones@company.com",
            "sender_name": "Sarah Jones",
            "subject": "Billing question about recent charge",
            "body": "Hello, I noticed a charge of $29.99 on my credit card from your company but I don't remember making this purchase. Could you please help me understand what this charge is for? My order reference might be ORD-7891. Thanks!",
            "date_received": datetime.now(timezone.utc)
        },
        {
            "sender": "mike.developer@tech.com",
            "sender_name": "Mike Developer",
            "subject": "Feature request: API rate limiting",
            "body": "Hi team, I'm a developer using your API and would love to see better rate limiting controls. Currently, I hit limits unexpectedly which breaks my application. Could you add configurable rate limits per API key? This would help many developers like me. Contact me at mike.dev@tech.com for more details.",
            "date_received": datetime.now(timezone.utc)
        },
        {
            "sender": "angry.customer@email.com",
            "sender_name": "Frustrated Customer",
            "subject": "Terrible service - demanding refund NOW",
            "body": "I am absolutely furious with your service. Nothing works as advertised and your support is useless. I want a full refund immediately or I'm reporting to BBB. This is the worst experience I've ever had. Call me at 555-9876 to resolve this NOW!",
            "date_received": datetime.now(timezone.utc)
        },
        {
            "sender": "happy.user@domain.com",
            "sender_name": "Happy User",
            "subject": "Love the new features!",
            "body": "Just wanted to say thank you for the recent updates. The new dashboard is amazing and has made my workflow so much better. Keep up the excellent work! You guys are the best.",
            "date_received": datetime.now(timezone.utc)
        }
    ]
    
    ingested_count = 0
    
    for email_data in sample_emails:
        # Extract information
        extracted = await extract_email_info(email_data["body"])
        sentiment = await analyze_sentiment(email_data["body"])
        
        # Compute priority
        email_with_sentiment = {**email_data, "sentiment": sentiment}
        priority_score, rationale = compute_priority_score(email_with_sentiment)
        
        # Create email object
        email = Email(
            sender=email_data["sender"],
            sender_name=email_data["sender_name"],
            subject=email_data["subject"],
            body=email_data["body"],
            date_received=email_data["date_received"],
            extracted=extracted,
            sentiment=sentiment,
            priority_score=priority_score,
            priority_rationale=rationale
        )
        
        # Save to database
        await db.emails.insert_one(email.dict())
        ingested_count += 1
    
    return {"ingested": ingested_count}

@api_router.get("/emails", response_model=List[EmailSummary])
async def get_emails(
    status: str = Query("pending", description="Filter by status"),
    limit: int = Query(50, description="Maximum number of emails"),
    sort: str = Query("priority_desc", description="Sort order")
):
    # Build query
    query = {}
    if status != "all":
        query["status"] = status
    
    # Build sort
    sort_field = "priority_score" if sort == "priority_desc" else "date_received"
    sort_direction = -1 if sort == "priority_desc" else -1
    
    emails = await db.emails.find(query).sort(sort_field, sort_direction).limit(limit).to_list(length=None)
    
    summaries = []
    for email in emails:
        preview = email["body"][:100] + "..." if len(email["body"]) > 100 else email["body"]
        summaries.append(EmailSummary(
            id=email["id"],
            sender=email["sender"],
            subject=email["subject"],
            sentiment=email["sentiment"],
            priority_score=email["priority_score"],
            status=email["status"],
            preview=preview,
            date_received=email["date_received"]
        ))
    
    return summaries

@api_router.get("/emails/{email_id}")
async def get_email_detail(email_id: str):
    email = await db.emails.find_one({"id": email_id})
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    
    # Convert ObjectId to string if present
    if "_id" in email:
        del email["_id"]
    
    return email

@api_router.post("/emails/{email_id}/generate")
async def generate_email_reply(email_id: str):
    email = await db.emails.find_one({"id": email_id})
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    
    # Get RAG retrieval hits
    query = f"{email['subject']} {email['body']}"
    retrieval_hits = retrieve_relevant_docs(query)
    
    # Generate reply
    draft_reply = await generate_reply(email, retrieval_hits)
    
    # Update email with retrieval hits and draft reply
    await db.emails.update_one(
        {"id": email_id},
        {
            "$set": {
                "retrieval_hits": [hit.dict() for hit in retrieval_hits],
                "draft_reply": draft_reply.dict(),
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    # Add audit log
    audit_entry = AuditLogEntry(
        event="generated",
        by="system",
        text=draft_reply.text
    )
    
    await db.emails.update_one(
        {"id": email_id},
        {"$push": {"audit_log": audit_entry.dict()}}
    )
    
    return {
        "draft_reply": draft_reply.dict(),
        "retrieval_hits": [hit.dict() for hit in retrieval_hits]
    }

@api_router.post("/emails/{email_id}/send")
async def send_email_reply(email_id: str, request: SendEmailRequest):
    email = await db.emails.find_one({"id": email_id})
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    
    # Add audit log for sending
    audit_entry = AuditLogEntry(
        event="sent",
        by="user",
        text=request.final_text
    )
    
    # Update email status and add audit log
    await db.emails.update_one(
        {"id": email_id},
        {
            "$set": {
                "status": "resolved",
                "updated_at": datetime.now(timezone.utc)
            },
            "$push": {"audit_log": audit_entry.dict()}
        }
    )
    
    return {
        "status": "sent",
        "mode": request.send_mode,
        "message": f"Email reply {'sent' if request.send_mode == 'real' else 'mock sent'} successfully"
    }

@api_router.get("/analytics", response_model=AnalyticsResponse)
async def get_analytics():
    # Get email counts
    total_emails = await db.emails.count_documents({})
    pending_count = await db.emails.count_documents({"status": "pending"})
    resolved_count = await db.emails.count_documents({"status": "resolved"})
    
    # Get sentiment breakdown
    sentiment_pipeline = [
        {"$group": {"_id": "$sentiment", "count": {"$sum": 1}}}
    ]
    sentiment_results = await db.emails.aggregate(sentiment_pipeline).to_list(length=None)
    sentiment_breakdown = {result["_id"]: result["count"] for result in sentiment_results}
    
    # Get average priority
    avg_priority_pipeline = [
        {"$group": {"_id": None, "avg_priority": {"$avg": "$priority_score"}}}
    ]
    avg_priority_results = await db.emails.aggregate(avg_priority_pipeline).to_list(length=None)
    avg_priority = avg_priority_results[0]["avg_priority"] if avg_priority_results else 0.0
    
    return AnalyticsResponse(
        total_emails=total_emails,
        pending_count=pending_count,
        resolved_count=resolved_count,
        sentiment_breakdown=sentiment_breakdown,
        avg_priority=round(avg_priority, 3)
    )

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
if __name__ == "__main__":
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=True)
