import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API = 'http://127.0.0.1:8000/api';

const KnowledgeBase = ({ onClose }) => {
  const [knowledgeItems, setKnowledgeItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: 'general'
  });

  useEffect(() => {
    fetchKnowledgeBase();
  }, []);

  const fetchKnowledgeBase = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/knowledge-base`);
      setKnowledgeItems(response.data);
    } catch (error) {
      console.error('Error fetching knowledge base:', error);
      // Mock data for demo
      setKnowledgeItems([
        {
          id: "faq_01",
          title: "Refund Policy",
          content: "We offer full refunds within 30 days of purchase. To request a refund, contact support with your order ID.",
          category: "policy"
        },
        {
          id: "faq_02",
          title: "Shipping Information",
          content: "Standard shipping takes 3-5 business days. Express shipping is available for 1-2 day delivery.",
          category: "shipping"
        },
        {
          id: "tech_01",
          title: "Technical Support",
          content: "For technical issues, please provide your device information, browser version, and steps to reproduce the issue.",
          category: "technical"
        }
      ]);
    }
    setLoading(false);
  };

  const handleSave = async (item) => {
    setLoading(true);
    try {
      if (item.id) {
        // Update existing
        await axios.put(`${API}/knowledge-base/${item.id}`, item);
      } else {
        // Create new
        await axios.post(`${API}/knowledge-base`, item);
      }
      await fetchKnowledgeBase();
      setEditingItem(null);
      setShowAddForm(false);
      setFormData({ title: '', content: '', category: 'general' });
    } catch (error) {
      console.error('Error saving knowledge base item:', error);
    }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;
    
    setLoading(true);
    try {
      await axios.delete(`${API}/knowledge-base/${id}`);
      await fetchKnowledgeBase();
    } catch (error) {
      console.error('Error deleting knowledge base item:', error);
    }
    setLoading(false);
  };

  const getCategoryColor = (category) => {
    const colors = {
      policy: 'bg-blue-100 text-blue-800',
      shipping: 'bg-green-100 text-green-800',
      technical: 'bg-purple-100 text-purple-800',
      billing: 'bg-yellow-100 text-yellow-800',
      general: 'bg-gray-100 text-gray-800'
    };
    return colors[category] || colors.general;
  };

  const ItemForm = ({ item, onSave, onCancel }) => {
    const [localData, setLocalData] = useState(
      item || { title: '', content: '', category: 'general' }
    );

    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-4">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Title
            </label>
            <input
              type="text"
              value={localData.title}
              onChange={(e) => setLocalData({ ...localData, title: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter title..."
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category
            </label>
            <select
              value={localData.category}
              onChange={(e) => setLocalData({ ...localData, category: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="general">General</option>
              <option value="policy">Policy</option>
              <option value="shipping">Shipping</option>
              <option value="technical">Technical</option>
              <option value="billing">Billing</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Content
            </label>
            <textarea
              value={localData.content}
              onChange={(e) => setLocalData({ ...localData, content: e.target.value })}
              rows={4}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter content..."
            />
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={() => onSave(localData)}
              disabled={!localData.title || !localData.content}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50"
            >
              Save
            </button>
            <button
              onClick={onCancel}
              className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-lg font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Knowledge Base Management</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-medium text-gray-900">
              Knowledge Items ({knowledgeItems.length})
            </h3>
            <button
              onClick={() => setShowAddForm(true)}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Add New Item</span>
            </button>
          </div>

          {showAddForm && (
            <ItemForm
              onSave={handleSave}
              onCancel={() => setShowAddForm(false)}
            />
          )}

          <div className="space-y-4">
            {knowledgeItems.map((item) => (
              <div key={item.id}>
                {editingItem?.id === item.id ? (
                  <ItemForm
                    item={editingItem}
                    onSave={handleSave}
                    onCancel={() => setEditingItem(null)}
                  />
                ) : (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h4 className="text-lg font-medium text-gray-900">{item.title}</h4>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(item.category)}`}>
                            {item.category}
                          </span>
                        </div>
                        <p className="text-gray-700 text-sm leading-relaxed">{item.content}</p>
                      </div>
                      <div className="flex space-x-2 ml-4">
                        <button
                          onClick={() => setEditingItem(item)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {loading && (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default KnowledgeBase;