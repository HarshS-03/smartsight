import React, { useState, useEffect } from 'react';
import API from '../api/axios';

const MODELS = {
  users: {
    title: 'Users',
    endpoint: '/users/',
    columns: [
      { key: 'id', label: 'ID', type: 'number', readOnly: true },
      { key: 'username', label: 'Username', type: 'text' },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'first_name', label: 'First Name', type: 'text' },
      { key: 'last_name', label: 'Last Name', type: 'text' },
      { key: 'is_staff', label: 'Staff (Admin)', type: 'boolean' },
      { key: 'is_superuser', label: 'Superuser', type: 'boolean' },
      { key: 'password', label: 'Password (leave blank to keep)', type: 'password', hiddenInTable: true }
    ]
  },
  cameras: {
    title: 'Cameras',
    endpoint: '/cameras/',
    columns: [
      { key: 'id', label: 'ID', type: 'number', readOnly: true },
      { key: 'name', label: 'Camera Name', type: 'text' },
      { key: 'source', label: 'Source (0, 1, or RTSP)', type: 'text' },
      { key: 'is_active', label: 'Active', type: 'boolean' },
      { key: 'created_at', label: 'Created At', type: 'text', readOnly: true }
    ]
  },
  persons: {
    title: 'Persons',
    endpoint: '/persons/',
    columns: [
      { key: 'id', label: 'ID', type: 'number', readOnly: true },
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'created_at', label: 'Created At', type: 'text', readOnly: true }
    ]
  }
};

export default function AdminPanelPage() {
  const [activeModelKey, setActiveModelKey] = useState('users');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({});

  const activeModel = MODELS[activeModelKey];

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await API.get(activeModel.endpoint);
      setData(res.data);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch data. Ensure you have admin permissions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeModelKey]);

  const handleOpenModal = (record = null) => {
    if (record) {
      setIsEditing(true);
      setFormData(record);
    } else {
      setIsEditing(false);
      // Initialize empty form
      const initial = {};
      activeModel.columns.forEach(col => {
        if (!col.readOnly) {
          initial[col.key] = col.type === 'boolean' ? false : '';
        }
      });
      setFormData(initial);
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setFormData({});
  };

  const handleInputChange = (e, col) => {
    const value = col.type === 'boolean' ? e.target.checked : e.target.value;
    setFormData({ ...formData, [col.key]: value });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await API.put(`${activeModel.endpoint}${formData.id}/`, formData);
        let successMsg = `${activeModel.title.slice(0, -1)} updated successfully!`;
        if (activeModelKey === 'users' && formData.password) {
            successMsg += ' Password changed.';
        }
        if (window.showToast) window.showToast(successMsg, 'success');
      } else {
        await API.post(activeModel.endpoint, formData);
        if (window.showToast) window.showToast(`${activeModel.title.slice(0, -1)} added successfully!`, 'success');
      }
      handleCloseModal();
      fetchData();
    } catch (err) {
      console.error(err);
      let errorMsg = 'Error saving record. Please check inputs.';
      if (err.response && err.response.data) {
        if (typeof err.response.data === 'object') {
           errorMsg = Object.values(err.response.data).flat().join(', ');
        }
      }
      if (window.showToast) window.showToast(errorMsg, 'error');
      else alert(errorMsg);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this record?')) {
      try {
        await API.delete(`${activeModel.endpoint}${id}/`);
        if (window.showToast) window.showToast(`${activeModel.title.slice(0, -1)} deleted successfully!`, 'success');
        fetchData();
      } catch (err) {
        console.error(err);
        if (window.showToast) window.showToast('Error deleting record.', 'error');
        else alert('Error deleting record.');
      }
    }
  };

  return (
    <div className="admin-panel-container min-vh-100 position-relative" style={{ background: 'var(--bg-app)', color: 'var(--text-body)' }}>
      {/* Mesh Grid Background */}
      <div className="page-hero-bg-wrapper full-page" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none' }}>
        <div className="page-hero-bg"></div>
        <div className="page-hero-orb"></div>
      </div>
      
      {/* Hero Section */}
      <section className="position-relative pt-5 pb-4 px-3" style={{ background: 'linear-gradient(to bottom, rgba(13,110,253,0.05), transparent)', borderBottom: '1px solid var(--border-color)', zIndex: 1 }}>
        <div className="container mt-4">
          <div className="row align-items-center">
            <div className="col-md-8 text-center text-md-start">
              <h1 className="fw-bold mb-2">
                Admin <span className="text-primary">Dashboard</span>
              </h1>
              <p className="text-secondary mb-0">Manage system records, users, and core entities.</p>
            </div>
            <div className="col-md-4 text-center text-md-end mt-3 mt-md-0">
              <button onClick={() => handleOpenModal()} className="btn btn-primary rounded-pill px-4 fw-bold">
                <i className="bi bi-plus-lg me-2"></i> Add New {activeModel.title.slice(0, -1)}
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="container mt-4 pb-5 position-relative" style={{ zIndex: 1 }}>
        {/* Tabs */}
        <ul className="nav nav-pills nav-fill mb-4 p-1 rounded-pill shadow-sm" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
          {Object.entries(MODELS).map(([key, model]) => (
            <li className="nav-item" key={key}>
              <button
                className={`btn rounded-pill px-4 fw-bold w-100 ${activeModelKey === key ? 'shadow' : ''}`}
                onClick={() => setActiveModelKey(key)}
                style={{
                  cursor: 'pointer',
                  border: 'none',
                  color: activeModelKey === key ? '#ffffff' : 'var(--text-secondary)',
                  background: activeModelKey === key ? 'var(--bs-primary)' : 'transparent',
                  transition: 'all 0.3s ease'
                }}
              >
                {model.title}
              </button>
            </li>
          ))}
        </ul>

        {/* Data Table */}
        <div className="card shadow-sm rounded-4 border-0" style={{ background: 'var(--bg-surface-solid)' }}>
          <div className="card-body p-0">
            {loading ? (
              <div className="p-5 text-center text-secondary">
                <div className="spinner-border spinner-border-sm text-primary me-2"></div> Loading...
              </div>
            ) : error ? (
              <div className="p-5 text-center text-danger">{error}</div>
            ) : data.length === 0 ? (
              <div className="p-5 text-center text-secondary">No records found.</div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0" style={{ color: 'var(--text-body)' }}>
                  <thead style={{ background: 'rgba(0,0,0,0.03)' }}>
                    <tr>
                      {activeModel.columns.filter(c => !c.hiddenInTable).map((col) => (
                        <th key={col.key} className="border-0 text-secondary fw-semibold py-3 px-4">{col.label}</th>
                      ))}
                      <th className="border-0 text-secondary fw-semibold py-3 px-4 text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((row) => (
                      <tr key={row.id}>
                        {activeModel.columns.filter(c => !c.hiddenInTable).map((col) => (
                          <td key={col.key} className="border-bottom-0 py-3 px-4" style={{ borderColor: 'var(--border-color) !important' }}>
                            {col.type === 'boolean' ? (
                              row[col.key] ? <span className="badge bg-success">Yes</span> : <span className="badge bg-secondary">No</span>
                            ) : (
                              <span className="text-truncate d-inline-block" style={{ maxWidth: '200px' }}>
                                {row[col.key] !== null && row[col.key] !== undefined ? String(row[col.key]) : '-'}
                              </span>
                            )}
                          </td>
                        ))}
                        <td className="border-bottom-0 py-3 px-4 text-end" style={{ borderColor: 'var(--border-color) !important' }}>
                          <button onClick={() => handleOpenModal(row)} className="btn btn-sm rounded-circle me-2 d-inline-flex align-items-center justify-content-center shadow-sm" style={{ width: '32px', height: '32px', background: 'var(--bg-input)', border: '1px solid var(--border-color)' }} title="Edit">
                            <i className="bi bi-pencil-fill" style={{ color: '#3b82f6', fontSize: '0.85rem' }}></i>
                          </button>
                          <button onClick={() => handleDelete(row.id)} className="btn btn-sm rounded-circle d-inline-flex align-items-center justify-content-center shadow-sm" style={{ width: '32px', height: '32px', background: 'var(--bg-input)', border: '1px solid var(--border-color)' }} title="Delete">
                            <i className="bi bi-trash-fill" style={{ color: '#ef4444', fontSize: '0.85rem' }}></i>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dynamic Modal for Add/Edit */}
      {showModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1055 }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 rounded-4 shadow-lg" style={{ background: 'var(--bg-surface-solid)', color: 'var(--text-body)' }}>
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold">{isEditing ? 'Edit' : 'Add'} {activeModel.title.slice(0, -1)}</h5>
                <button type="button" className="btn-close" onClick={handleCloseModal}></button>
              </div>
              <div className="modal-body">
                <form id="adminForm" onSubmit={handleSave}>
                  {activeModel.columns.map((col) => {
                    if (col.readOnly && !isEditing) return null;
                    if (col.readOnly) {
                      return (
                        <div className="mb-3" key={col.key}>
                          <label className="form-label small fw-semibold text-secondary mb-1">{col.label}</label>
                          <input type="text" className="form-control bg-light" value={formData[col.key] || ''} disabled style={{ background: 'var(--bg-input)', borderColor: 'var(--border-color)', color: 'var(--text-body)' }} />
                        </div>
                      );
                    }
                    if (col.type === 'boolean') {
                      return (
                        <div className="form-check form-switch mb-3" key={col.key}>
                          <input className="form-check-input" type="checkbox" checked={!!formData[col.key]} onChange={(e) => handleInputChange(e, col)} />
                          <label className="form-check-label fw-semibold">{col.label}</label>
                        </div>
                      );
                    }
                    return (
                      <div className="mb-3" key={col.key}>
                        <label className="form-label small fw-semibold text-secondary mb-1">{col.label}</label>
                        <input
                          type={col.type === 'password' ? 'password' : 'text'}
                          className="form-control"
                          value={formData[col.key] || ''}
                          onChange={(e) => handleInputChange(e, col)}
                          placeholder={col.type === 'password' ? (isEditing ? 'Leave blank to keep current password' : 'Enter new password') : ''}
                          required={!isEditing && col.type === 'password'}
                          style={{ background: 'var(--bg-input)', borderColor: 'var(--border-color)', color: 'var(--text-body)' }}
                        />
                      </div>
                    );
                  })}
                </form>
              </div>
              <div className="modal-footer border-0 pt-0">
                <button type="button" className="btn btn-light rounded-pill px-4" onClick={handleCloseModal}>Cancel</button>
                <button type="submit" form="adminForm" className="btn btn-primary rounded-pill px-4 fw-bold">Save Changes</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
