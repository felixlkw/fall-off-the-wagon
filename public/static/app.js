// 작심삼일 RUN DAO - Frontend JavaScript

// Global app state
window.RunDAO = {
  currentUser: null,
  currentCrew: null,
  apiBase: window.location.origin + '/api'
};

// Utility functions
const Utils = {
  // Format date to Korean locale
  formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  },

  // Format distance
  formatDistance(km) {
    return `${km.toFixed(1)}km`;
  },

  // Format duration
  formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}시간 ${minutes}분`;
    }
    return `${minutes}분`;
  },

  // Show notification
  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
      type === 'success' ? 'bg-green-500 text-white' :
      type === 'error' ? 'bg-red-500 text-white' :
      'bg-blue-500 text-white'
    }`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 3000);
  },

  // API request wrapper
  async apiRequest(endpoint, options = {}) {
    const url = `${window.RunDAO.apiBase}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'API request failed');
      }
      
      return data;
    } catch (error) {
      console.error('API Error:', error);
      Utils.showNotification(error.message, 'error');
      throw error;
    }
  }
};

// API wrapper functions
const API = {
  async getHealth() {
    return Utils.apiRequest('/health');
  },

  async getUsers() {
    return Utils.apiRequest('/users');
  },

  async getUser(userId) {
    return Utils.apiRequest(`/users/${userId}`);
  },

  async getCrews() {
    return Utils.apiRequest('/crews');
  },

  async getCrewQuests(crewId) {
    return Utils.apiRequest(`/crews/${crewId}/quests`);
  },

  async getQuest(questId) {
    return Utils.apiRequest(`/quests/${questId}`);
  }
};

// UI Component helpers
const UI = {
  // Create progress bar
  createProgressBar(percentage, className = '') {
    return `
      <div class="progress-bar ${className}">
        <div class="progress-fill" style="width: ${Math.min(100, Math.max(0, percentage))}%"></div>
      </div>
      <span class="text-sm text-gray-600 mt-1">${percentage.toFixed(1)}%</span>
    `;
  },

  // Create status badge
  createStatusBadge(status) {
    const statusMap = {
      'success': { class: 'status-success', text: '성공', icon: '✅' },
      'active': { class: 'status-pending', text: '진행중', icon: '🏃‍♂️' },
      'pending': { class: 'status-pending', text: '대기중', icon: '⏳' },
      'fail': { class: 'status-failed', text: '실패', icon: '❌' },
      'forfeit': { class: 'status-failed', text: '포기', icon: '🏳️' }
    };

    const statusInfo = statusMap[status] || { class: 'bg-gray-100 text-gray-800', text: status, icon: '❓' };
    return `<span class="${statusInfo.class}">${statusInfo.icon} ${statusInfo.text}</span>`;
  },

  // Create user avatar
  createUserAvatar(user, size = 'w-8 h-8') {
    const colors = ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500'];
    const colorClass = colors[Math.abs(user.id.charCodeAt(0)) % colors.length];
    const initials = user.nickname ? user.nickname.substring(0, 2) : '🏃‍♂️';

    return `
      <div class="${size} ${colorClass} rounded-full flex items-center justify-center text-white font-semibold text-sm">
        ${initials}
      </div>
    `;
  }
};

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  console.log('🏃‍♂️ 작심삼일 RUN DAO - Frontend Loaded');
  
  // Add fade-in animation to main content
  const mainContent = document.querySelector('body > *');
  if (mainContent) {
    mainContent.classList.add('fade-in-up');
  }

  // Test API connection
  API.getHealth()
    .then(data => {
      console.log('✅ API Health Check:', data);
      if (data.users > 0) {
        Utils.showNotification(`시스템 정상 (${data.users}명 사용자)`, 'success');
      }
    })
    .catch(error => {
      console.error('❌ API Health Check Failed:', error);
    });

  // Add click handlers for API test links
  document.querySelectorAll('a[href^="/api/"]').forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      const endpoint = this.getAttribute('href').replace('/api', '');
      
      Utils.apiRequest(endpoint)
        .then(data => {
          console.log(`API Response for ${endpoint}:`, data);
          
          // Show formatted response in a modal or console
          const jsonString = JSON.stringify(data, null, 2);
          const newWindow = window.open('', '_blank');
          newWindow.document.write(`
            <html>
              <head><title>API Response: ${endpoint}</title></head>
              <body style="font-family: monospace; padding: 20px; background: #f5f5f5;">
                <h3>GET ${endpoint}</h3>
                <pre style="background: white; padding: 20px; border-radius: 8px; overflow: auto;">${jsonString}</pre>
                <button onclick="window.close()" style="margin-top: 20px; padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">닫기</button>
              </body>
            </html>
          `);
        })
        .catch(error => {
          Utils.showNotification(`API 요청 실패: ${error.message}`, 'error');
        });
    });
  });
});

// Export to global scope
window.Utils = Utils;
window.API = API;
window.UI = UI;