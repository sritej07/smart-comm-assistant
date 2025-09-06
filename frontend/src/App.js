import React, { useState, useEffect } from "react";
import "./App.css";
import axios from "axios";
import Toast from "./components/Toast";
import KnowledgeBase from "./components/KnowledgeBase";

const API = 'http://127.0.0.1:8000/api';

const App = () => {
  const [emails, setEmails] = useState([]);
  const [sentEmails, setSentEmails] = useState([]);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('inbox');
  const [draftText, setDraftText] = useState('');
  const [toasts, setToasts] = useState([]);
  const [showKnowledgeBase, setShowKnowledgeBase] = useState(false);

  useEffect(() => {
    fetchEmails();
    fetchSentEmails();
    fetchAnalytics();
  }, []);

  const addToast = (message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const fetchEmails = async () => {
    try {
      const response = await axios.get(`${API}/emails?status=pending&sort=priority_desc`);
      setEmails(response.data);
    } catch (error) {
      console.error('Error fetching emails:', error);
    }
  };

  const fetchSentEmails = async () => {
    try {
      const response = await axios.get(`${API}/emails?status=resolved&sort=priority_desc`);
      setSentEmails(response.data);
    } catch (error) {
      console.error('Error fetching sent emails:', error);
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
      await fetchSentEmails();
      await fetchAnalytics();
      addToast('Demo emails loaded successfully!', 'success');
    } catch (error) {
      console.error('Error ingesting emails:', error);
      addToast('Failed to load demo emails', 'error');
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
      addToast('Failed to load email details', 'error');
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
      addToast('AI reply generated successfully!', 'success');
    } catch (error) {
      console.error('Error generating reply:', error);
      addToast('Failed to generate AI reply', 'error');
    }
    setLoading(false);
  };

  const sendReply = async () => {
    if (!selectedEmail || !draftText) return;
    setLoading(true);
    try {
      const response = await axios.post(`${API}/emails/${selectedEmail.id}/send`, {
        final_text: draftText,
        send_mode: 'mock'
      });
      await fetchEmails();
      await fetchSentEmails();
      await fetchAnalytics();
      
      // Update selected email with sent reply info
      const updatedEmailResponse = await axios.get(`${API}/emails/${selectedEmail.id}`);
      setSelectedEmail(updatedEmailResponse.data);
      
      addToast('Email sent successfully!', 'success');
    } catch (error) {
      console.error('Error sending reply:', error);
      addToast('Failed to send email', 'error');
    }
    setLoading(false);
  };

  const rebuildKnowledgeBase = async () => {
    setLoading(true);
    try {
      await axios.post(`${API}/knowledge-base/rebuild`);
      addToast('Knowledge base rebuilt successfully!', 'success');
    } catch (error) {
      console.error('Error rebuilding knowledge base:', error);
      addToast('Failed to rebuild knowledge base', 'error');
    }
    setLoading(false);
  };

  const getPriorityBadge = (score) => {
    if (score >= 0.7) return { text: 'HIGH', class: 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg' };
    if (score >= 0.4) return { text: 'MED', class: 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-white shadow-lg' };
    return { text: 'LOW', class: 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg' };
  };

  const getSentimentColor = (sentiment) => {
    switch (sentiment) {
      case 'Positive': return 'text-green-600 font-semibold';
      case 'Negative': return 'text-red-600 font-semibold';
      default: return 'text-gray-600 font-semibold';
    }
  };

  const getSentimentIcon = (sentiment) => {
    switch (sentiment) {
      case 'Positive':
        return (
          <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 100-2 1 1 0 000 2zm7-1a1 1 0 11-2 0 1 1 0 012 0zm-.464 5.535a1 1 0 10-1.415-1.414 3 3 0 01-4.242 0 1 1 0 00-1.415 1.414 5 5 0 007.072 0z" clipRule="evenodd" />
          </svg>
        );
      case 'Negative':
        return (
          <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 100-2 1 1 0 000 2zm7-1a1 1 0 11-2 0 1 1 0 012 0zm-7.536 5.879a1 1 0 001.415 1.414 3 3 0 004.242 0 1 1 0 001.415-1.414 5 5 0 00-7.072 0z" clipRule="evenodd" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 100-2 1 1 0 000 2zm7-1a1 1 0 11-2 0 1 1 0 012 0zm-5 6a1 1 0 011-1h2a1 1 0 110 2H8a1 1 0 01-1-1z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  const EmailCard = ({ email, onClick, isSelected }) => {
    const priority = getPriorityBadge(email.priority_score);
    return (
      <div
        onClick={() => onClick(email.id)}
        className={`p-4 cursor-pointer transition-all duration-200 border-l-4 hover:shadow-md ${
          isSelected 
            ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-l-blue-500 shadow-md' 
            : 'bg-white border-l-transparent hover:bg-gray-50 hover:border-l-gray-300'
        }`}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-2">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${priority.class}`}>
                {priority.text}
              </span>
              <div className="flex items-center space-x-1">
                {getSentimentIcon(email.sentiment)}
                <span className={`text-xs ${getSentimentColor(email.sentiment)}`}>
                  {email.sentiment}
                </span>
              </div>
            </div>
            <p className="text-sm font-semibold text-gray-900 truncate mb-1">
              {email.sender_name || email.sender}
            </p>
            <p className="text-sm text-gray-600 truncate mb-2 font-medium">
              {email.subject}
            </p>
            <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
              {email.preview}
            </p>
            <div className="mt-2 text-xs text-gray-400">
              {new Date(email.date_received).toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const AnalyticsCards = () => {
    if (!analytics) return null;

    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium">Total Emails</p>
              <p className="text-3xl font-bold">{analytics.total_emails}</p>
            </div>
            <div className="bg-blue-400 bg-opacity-30 rounded-full p-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-yellow-100 text-sm font-medium">Pending</p>
              <p className="text-3xl font-bold">{analytics.pending_count}</p>
            </div>
            <div className="bg-yellow-400 bg-opacity-30 rounded-full p-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm font-medium">Resolved</p>
              <p className="text-3xl font-bold">{analytics.resolved_count}</p>
            </div>
            <div className="bg-green-400 bg-opacity-30 rounded-full p-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm font-medium">Avg Priority</p>
              <p className="text-3xl font-bold">{analytics.avg_priority.toFixed(2)}</p>
            </div>
            <div className="bg-purple-400 bg-opacity-30 rounded-full p-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const SentReplySection = ({ sentReply }) => {
    if (!sentReply) return null;

    return (
      <div>
        <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center space-x-2">
          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
          <span>Sent Reply</span>
        </h4>
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center space-x-2 text-sm text-green-700">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="font-medium">Sent by: {sentReply.sent_by}</span>
            </div>
            <div className="flex items-center space-x-2 text-sm text-green-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{new Date(sentReply.sent_at).toLocaleString()}</span>
            </div>
          </div>
          <div className="bg-white rounded-lg p-3 border border-green-200">
            <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
              {sentReply.reply_text}
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Toast Notifications */}
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => removeToast(toast.id)}
        />
      ))}

      {/* Knowledge Base Modal */}
      {showKnowledgeBase && (
        <KnowledgeBase onClose={() => setShowKnowledgeBase(false)} />
      )}

      {/* Header */}
      <header className="bg-white shadow-lg border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-lg">SC</span>
                </div>
                <div className="ml-4">
                  <h1 className="text-2xl font-bold text-gray-900">Smart Comm Assistant</h1>
                  <p className="text-sm text-gray-500">AI-Powered Email Management</p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowKnowledgeBase(true)}
                className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white px-4 py-2 rounded-lg font-medium shadow-lg transition-all duration-200 flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <span>Knowledge Base</span>
              </button>
              <button
                onClick={rebuildKnowledgeBase}
                disabled={loading}
                className="bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white px-4 py-2 rounded-lg font-medium shadow-lg transition-all duration-200 disabled:opacity-50 flex items-center space-x-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Rebuilding...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Rebuild KB</span>
                  </>
                )}
              </button>
              {emails.length === 0 && (
                <button
                  onClick={ingestMockEmails}
                  disabled={loading}
                  className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-2 rounded-lg font-medium shadow-lg transition-all duration-200 disabled:opacity-50 flex items-center space-x-2"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Loading...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span>Load Demo Emails</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="border-b border-gray-200 bg-white rounded-t-lg mt-6">
          <nav className="-mb-px flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('inbox')}
              className={`py-4 px-1 border-b-2 font-semibold text-sm transition-colors duration-200 ${
                activeTab === 'inbox'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <span>Inbox ({emails.length})</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('sent')}
              className={`py-4 px-1 border-b-2 font-semibold text-sm transition-colors duration-200 ${
                activeTab === 'sent'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                <span>Sent ({sentEmails.length})</span>
              </div>
            </button>
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
        <div className="bg-white rounded-b-lg shadow-xl">
          <div className="p-6">
            {/* Analytics Cards */}
            <AnalyticsCards />

            {activeTab === 'inbox' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Email List */}
                <div className="lg:col-span-1">
                  <div className="bg-gray-50 rounded-xl shadow-inner">
                    <div className="p-4 border-b border-gray-200">
                      <h2 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2-2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                        </svg>
                        <span>Pending Emails ({emails.length})</span>
                      </h2>
                    </div>
                    <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
                      {emails.map((email) => (
                        <EmailCard
                          key={email.id}
                          email={email}
                          onClick={selectEmail}
                          isSelected={selectedEmail?.id === email.id}
                        />
                      ))}
                      {emails.length === 0 && (
                        <div className="p-8 text-center text-gray-500">
                          <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2-2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                          </svg>
                          <p className="mt-2 text-sm">No pending emails</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Email Detail */}
                <div className="lg:col-span-2">
                  {selectedEmail ? (
                    <div className="bg-white rounded-xl shadow-lg border border-gray-200">
                      <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">
                              {selectedEmail.subject}
                            </h3>
                            <p className="text-sm text-gray-600 mb-3">
                              From: <span className="font-semibold">{selectedEmail.sender_name}</span> ({selectedEmail.sender})
                            </p>
                            <div className="flex items-center space-x-4">
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${
                                getPriorityBadge(selectedEmail.priority_score).class
                              }`}>
                                Priority: {selectedEmail.priority_score}
                              </span>
                              <div className="flex items-center space-x-1">
                                {getSentimentIcon(selectedEmail.sentiment)}
                                <span className={`text-sm ${getSentimentColor(selectedEmail.sentiment)}`}>
                                  {selectedEmail.sentiment}
                                </span>
                              </div>
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${
                                selectedEmail.status === 'resolved' 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-yellow-100 text-yellow-800'
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
                          <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center space-x-2">
                            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span>Email Content</span>
                          </h4>
                          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200">
                            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                              {selectedEmail.body}
                            </p>
                          </div>
                        </div>

                        {/* Extracted Information */}
                        {selectedEmail.extracted && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center space-x-2">
                              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                              </svg>
                              <span>Extracted Information</span>
                            </h4>
                            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200">
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div className="flex items-center space-x-2">
                                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                  </svg>
                                  <span><span className="font-semibold">Phone:</span> {selectedEmail.extracted.phone || 'Not found'}</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                  </svg>
                                  <span><span className="font-semibold">Alt Email:</span> {selectedEmail.extracted.alt_email || 'Not found'}</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                  </svg>
                                  <span><span className="font-semibold">Order ID:</span> {selectedEmail.extracted.order_id || 'Not found'}</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                  </svg>
                                  <span><span className="font-semibold">Action:</span> {selectedEmail.extracted.requested_action || 'Not specified'}</span>
                                </div>
                              </div>
                              {selectedEmail.extracted.urgency_keywords && selectedEmail.extracted.urgency_keywords.length > 0 && (
                                <div className="mt-4">
                                  <span className="font-semibold text-red-700 flex items-center space-x-2 mb-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                    </svg>
                                    <span>Urgency Keywords:</span>
                                  </span>
                                  <div className="flex flex-wrap gap-2">
                                    {selectedEmail.extracted.urgency_keywords.map((keyword, idx) => (
                                      <span key={idx} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">
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
                            <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center space-x-2">
                              <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                              </svg>
                              <span>Knowledge Base Matches</span>
                            </h4>
                            <div className="space-y-3">
                              {selectedEmail.retrieval_hits.map((hit, idx) => (
                                <div key={idx} className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-4 border border-purple-200">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-semibold text-purple-900">{hit.title}</span>
                                    <span className="text-xs text-purple-600 bg-purple-100 px-2 py-1 rounded-full font-medium">
                                      Score: {hit.score.toFixed(2)}
                                    </span>
                                  </div>
                                  <p className="text-sm text-purple-800 leading-relaxed">{hit.snippet}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Show Sent Reply or Draft Reply based on status */}
                        {selectedEmail.status === 'resolved' && selectedEmail.sent_reply ? (
                          <SentReplySection sentReply={selectedEmail.sent_reply} />
                        ) : (
                          /* Draft Reply */
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-sm font-semibold text-gray-900 flex items-center space-x-2">
                                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                                <span>Draft Reply</span>
                              </h4>
                              <button
                                onClick={generateReply}
                                disabled={loading}
                                className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-lg transition-all duration-200 disabled:opacity-50 flex items-center space-x-2"
                              >
                                {loading ? (
                                  <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    <span>Generating...</span>
                                  </>
                                ) : (
                                  <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                    <span>Generate AI Reply</span>
                                  </>
                                )}
                              </button>
                            </div>
                            <textarea
                              value={draftText}
                              onChange={(e) => setDraftText(e.target.value)}
                              rows={6}
                              className="w-full border border-gray-300 rounded-xl p-4 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gradient-to-br from-white to-gray-50"
                              placeholder="AI-generated reply will appear here..."
                              disabled={selectedEmail.status === 'resolved'}
                            />
                            {selectedEmail.draft_reply && (
                              <div className="mt-3 flex items-center justify-between">
                                <div className="flex items-center space-x-4 text-xs text-gray-500">
                                  <div className="flex items-center space-x-1">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                    <span>Confidence: {(selectedEmail.draft_reply.confidence * 100).toFixed(0)}%</span>
                                  </div>
                                  {selectedEmail.draft_reply.sources_used && selectedEmail.draft_reply.sources_used.length > 0 && (
                                    <div className="flex items-center space-x-1">
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                      </svg>
                                      <span>Sources: {selectedEmail.draft_reply.sources_used.join(', ')}</span>
                                    </div>
                                  )}
                                </div>
                                <button
                                  onClick={sendReply}
                                  disabled={loading || !draftText || selectedEmail.status === 'resolved'}
                                  className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-2 rounded-lg text-sm font-semibold shadow-lg transition-all duration-200 disabled:opacity-50 flex items-center space-x-2"
                                >
                                  {loading ? (
                                    <>
                                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                      <span>Sending...</span>
                                    </>
                                  ) : (
                                    <>
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                      </svg>
                                      <span>Send Reply</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white rounded-xl shadow-lg p-12 text-center border border-gray-200">
                      <div className="text-gray-400">
                        <svg className="mx-auto h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">No email selected</h3>
                        <p className="text-sm text-gray-500 max-w-sm mx-auto">
                          Select an email from the list to view details and generate AI-powered replies with advanced analytics.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'sent' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Sent Email List */}
                <div className="lg:col-span-1">
                  <div className="bg-gray-50 rounded-xl shadow-inner">
                    <div className="p-4 border-b border-gray-200">
                      <h2 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                        <span>Sent Emails ({sentEmails.length})</span>
                      </h2>
                    </div>
                    <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
                      {sentEmails.map((email) => (
                        <EmailCard
                          key={email.id}
                          email={email}
                          onClick={selectEmail}
                          isSelected={selectedEmail?.id === email.id}
                        />
                      ))}
                      {sentEmails.length === 0 && (
                        <div className="p-12 text-center text-gray-500">
                          <svg className="mx-auto h-16 w-16 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                          </svg>
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">No sent emails</h3>
                          <p className="text-sm text-gray-500">Emails you send will appear here</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Sent Email Detail */}
                <div className="lg:col-span-2">
                  {selectedEmail ? (
                    <div className="bg-white rounded-xl shadow-lg border border-gray-200">
                      <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-green-50 to-emerald-50">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">
                              {selectedEmail.subject}
                            </h3>
                            <p className="text-sm text-gray-600 mb-3">
                              From: <span className="font-semibold">{selectedEmail.sender_name}</span> ({selectedEmail.sender})
                            </p>
                            <div className="flex items-center space-x-4">
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${
                                getPriorityBadge(selectedEmail.priority_score).class
                              }`}>
                                Priority: {selectedEmail.priority_score}
                              </span>
                              <div className="flex items-center space-x-1">
                                {getSentimentIcon(selectedEmail.sentiment)}
                                <span className={`text-sm ${getSentimentColor(selectedEmail.sentiment)}`}>
                                  {selectedEmail.sentiment}
                                </span>
                              </div>
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-800">
                                {selectedEmail.status}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="p-6 space-y-6">
                        {/* Original Email Body */}
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center space-x-2">
                            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                            </svg>
                            <span>Original Email</span>
                          </h4>
                          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200">
                            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                              {selectedEmail.body}
                            </p>
                          </div>
                        </div>

                        {/* Customer Contact Information */}
                        {selectedEmail.extracted && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center space-x-2">
                              <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              <span>Customer Contact Details</span>
                            </h4>
                            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl p-4 border border-indigo-200">
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div className="flex items-center space-x-2">
                                  <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                  </svg>
                                  <span><span className="font-semibold">Email:</span> {selectedEmail.sender}</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                  </svg>
                                  <span><span className="font-semibold">Name:</span> {selectedEmail.sender_name}</span>
                                </div>
                                {selectedEmail.extracted.phone && (
                                  <div className="flex items-center space-x-2">
                                    <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                    </svg>
                                    <span><span className="font-semibold">Phone:</span> {selectedEmail.extracted.phone}</span>
                                  </div>
                                )}
                                {selectedEmail.extracted.alt_email && (
                                  <div className="flex items-center space-x-2">
                                    <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                    <span><span className="font-semibold">Alt Email:</span> {selectedEmail.extracted.alt_email}</span>
                                  </div>
                                )}
                                {selectedEmail.extracted.order_id && (
                                  <div className="flex items-center space-x-2">
                                    <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                    </svg>
                                    <span><span className="font-semibold">Order ID:</span> {selectedEmail.extracted.order_id}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Sent Reply Section */}
                        {selectedEmail.sent_reply && (
                          <SentReplySection sentReply={selectedEmail.sent_reply} />
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white rounded-xl shadow-lg p-12 text-center border border-gray-200">
                      <div className="text-gray-400">
                        <svg className="mx-auto h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">No email selected</h3>
                        <p className="text-sm text-gray-500 max-w-sm mx-auto">
                          Select a sent email from the list to view the original message and your response.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;