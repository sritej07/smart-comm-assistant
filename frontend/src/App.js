import React, { useState, useEffect } from "react";
import "./App.css";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const App = () => {
  const [emails, setEmails] = useState([]);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('inbox');
  const [draftText, setDraftText] = useState('');

  useEffect(() => {
    fetchEmails();
    fetchAnalytics();
  }, []);

  const fetchEmails = async () => {
    try {
      const response = await axios.get(`${API}/emails?sort=priority_desc`);
      setEmails(response.data);
    } catch (error) {
      console.error('Error fetching emails:', error);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const response = await axios.get(`${API}/analytics`);
      setAnalytics(response.data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  };

  const ingestMockEmails = async () => {
    setLoading(true);
    try {
      await axios.post(`${API}/emails/ingest/mock`);
      await fetchEmails();
      await fetchAnalytics();
    } catch (error) {
      console.error('Error ingesting emails:', error);
    }
    setLoading(false);
  };

  const selectEmail = async (emailId) => {
    try {
      const response = await axios.get(`${API}/emails/${emailId}`);
      setSelectedEmail(response.data);
      setDraftText(response.data.draft_reply?.text || '');
    } catch (error) {
      console.error('Error fetching email details:', error);
    }
  };

  const generateReply = async () => {
    if (!selectedEmail) return;
    setLoading(true);
    try {
      const response = await axios.post(`${API}/emails/${selectedEmail.id}/generate`);
      setSelectedEmail({
        ...selectedEmail,
        draft_reply: response.data.draft_reply,
        retrieval_hits: response.data.retrieval_hits
      });
      setDraftText(response.data.draft_reply.text);
    } catch (error) {
      console.error('Error generating reply:', error);
    }
    setLoading(false);
  };

  const sendReply = async () => {
    if (!selectedEmail || !draftText) return;
    setLoading(true);
    try {
      await axios.post(`${API}/emails/${selectedEmail.id}/send`, {
        final_text: draftText,
        send_mode: 'mock'
      });
      await fetchEmails();
      await fetchAnalytics();
      setSelectedEmail({...selectedEmail, status: 'resolved'});
    } catch (error) {
      console.error('Error sending reply:', error);
    }
    setLoading(false);
  };

  const getPriorityBadge = (score) => {
    if (score >= 0.7) return { text: 'HIGH', class: 'bg-red-100 text-red-800' };
    if (score >= 0.4) return { text: 'MED', class: 'bg-yellow-100 text-yellow-800' };
    return { text: 'LOW', class: 'bg-green-100 text-green-800' };
  };

  const getSentimentColor = (sentiment) => {
    switch (sentiment) {
      case 'Positive': return 'text-green-600';
      case 'Negative': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">SC</span>
                </div>
                <h1 className="ml-3 text-xl font-semibold text-gray-900">Smart Comm Assistant</h1>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={ingestMockEmails}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Load Demo Emails'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('inbox')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'inbox'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Inbox
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'analytics'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Analytics
            </button>
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'inbox' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Email List */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow">
                <div className="p-4 border-b">
                  <h2 className="text-lg font-medium text-gray-900">
                    Emails ({emails.length})
                  </h2>
                </div>
                <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
                  {emails.map((email) => {
                    const priority = getPriorityBadge(email.priority_score);
                    return (
                      <div
                        key={email.id}
                        onClick={() => selectEmail(email.id)}
                        className={`p-4 cursor-pointer hover:bg-gray-50 ${
                          selectedEmail?.id === email.id ? 'bg-blue-50 border-r-2 border-blue-500' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-1">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${priority.class}`}>
                                {priority.text}
                              </span>
                              <span className={`text-xs ${getSentimentColor(email.sentiment)}`}>
                                {email.sentiment}
                              </span>
                            </div>
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {email.sender}
                            </p>
                            <p className="text-sm text-gray-600 truncate">
                              {email.subject}
                            </p>
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                              {email.preview}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Email Detail */}
            <div className="lg:col-span-2">
              {selectedEmail ? (
                <div className="bg-white rounded-lg shadow">
                  <div className="p-6 border-b">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">
                          {selectedEmail.subject}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          From: {selectedEmail.sender} ({selectedEmail.sender_name})
                        </p>
                        <div className="flex items-center space-x-4 mt-2">
                          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                            getPriorityBadge(selectedEmail.priority_score).class
                          }`}>
                            Priority: {selectedEmail.priority_score}
                          </span>
                          <span className={`text-sm ${getSentimentColor(selectedEmail.sentiment)}`}>
                            {selectedEmail.sentiment}
                          </span>
                          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                            selectedEmail.status === 'resolved' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {selectedEmail.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 space-y-6">
                    {/* Email Body */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Email Content</h4>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">
                          {selectedEmail.body}
                        </p>
                      </div>
                    </div>

                    {/* Extracted Information */}
                    {selectedEmail.extracted && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-2">Extracted Information</h4>
                        <div className="bg-gray-50 rounded-lg p-4">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="font-medium">Phone:</span> {selectedEmail.extracted.phone || 'Not found'}
                            </div>
                            <div>
                              <span className="font-medium">Alt Email:</span> {selectedEmail.extracted.alt_email || 'Not found'}
                            </div>
                            <div>
                              <span className="font-medium">Order ID:</span> {selectedEmail.extracted.order_id || 'Not found'}
                            </div>
                            <div>
                              <span className="font-medium">Action:</span> {selectedEmail.extracted.requested_action || 'Not specified'}
                            </div>
                          </div>
                          {selectedEmail.extracted.urgency_keywords && selectedEmail.extracted.urgency_keywords.length > 0 && (
                            <div className="mt-2">
                              <span className="font-medium">Urgency Keywords:</span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {selectedEmail.extracted.urgency_keywords.map((keyword, idx) => (
                                  <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                                    {keyword}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* RAG Retrieval Hits */}
                    {selectedEmail.retrieval_hits && selectedEmail.retrieval_hits.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-2">Knowledge Base Matches</h4>
                        <div className="space-y-2">
                          {selectedEmail.retrieval_hits.map((hit, idx) => (
                            <div key={idx} className="bg-blue-50 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-medium text-blue-900">{hit.title}</span>
                                <span className="text-xs text-blue-600">Score: {hit.score.toFixed(2)}</span>
                              </div>
                              <p className="text-sm text-blue-800">{hit.snippet}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Draft Reply */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium text-gray-900">Draft Reply</h4>
                        <button
                          onClick={generateReply}
                          disabled={loading}
                          className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm font-medium disabled:opacity-50"
                        >
                          {loading ? 'Generating...' : 'Generate AI Reply'}
                        </button>
                      </div>
                      <textarea
                        value={draftText}
                        onChange={(e) => setDraftText(e.target.value)}
                        rows={6}
                        className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="AI-generated reply will appear here..."
                      />
                      {selectedEmail.draft_reply && (
                        <div className="mt-2 flex items-center justify-between">
                          <div className="flex items-center space-x-4 text-xs text-gray-500">
                            <span>Confidence: {(selectedEmail.draft_reply.confidence * 100).toFixed(0)}%</span>
                            {selectedEmail.draft_reply.sources_used && selectedEmail.draft_reply.sources_used.length > 0 && (
                              <span>Sources: {selectedEmail.draft_reply.sources_used.join(', ')}</span>
                            )}
                          </div>
                          <button
                            onClick={sendReply}
                            disabled={loading || !draftText || selectedEmail.status === 'resolved'}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
                          >
                            {loading ? 'Sending...' : 'Send (Mock)'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow p-8 text-center">
                  <div className="text-gray-400">
                    <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No email selected</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Select an email from the list to view details and generate AI-powered replies.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'analytics' && analytics && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Total Emails</p>
                    <p className="text-2xl font-semibold text-gray-900">{analytics.total_emails}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-yellow-500 rounded-md flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Pending</p>
                    <p className="text-2xl font-semibold text-gray-900">{analytics.pending_count}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Resolved</p>
                    <p className="text-2xl font-semibold text-gray-900">{analytics.resolved_count}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-purple-500 rounded-md flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Avg Priority</p>
                    <p className="text-2xl font-semibold text-gray-900">{analytics.avg_priority.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Sentiment Distribution</h3>
              <div className="space-y-3">
                {Object.entries(analytics.sentiment_breakdown).map(([sentiment, count]) => (
                  <div key={sentiment} className="flex items-center">
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className={`font-medium ${getSentimentColor(sentiment)}`}>{sentiment}</span>
                        <span className="text-gray-500">{count}</span>
                      </div>
                      <div className="mt-1 w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            sentiment === 'Positive' ? 'bg-green-500' : 
                            sentiment === 'Negative' ? 'bg-red-500' : 'bg-gray-500'
                          }`}
                          style={{ width: `${(count / analytics.total_emails) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;