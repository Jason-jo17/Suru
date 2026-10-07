// Mock data based on the python script's JSON output
const candidatesData = [
    {
      "participant_id": "PT_001",
      "laya_sector": "Agriculture",
      "laya_feasibility_probability": 0.9,
      "laya_founder_score": 8,
      "final_ai_score": 85.0,
      "ai_recommendation": "Shortlist (Top 1000)",
      "requires_human_calibration": true
    },
    {
      "participant_id": "PT_002",
      "laya_sector": "Other",
      "laya_feasibility_probability": 0.2,
      "laya_founder_score": 3,
      "final_ai_score": 25.0,
      "ai_recommendation": "Community",
      "requires_human_calibration": false
    },
    {
      "participant_id": "PT_003",
      "laya_sector": "Technology",
      "laya_feasibility_probability": 0.75,
      "laya_founder_score": 7,
      "final_ai_score": 72.5,
      "ai_recommendation": "Shortlist (Top 1000)",
      "requires_human_calibration": false
    },
    {
      "participant_id": "PT_004",
      "laya_sector": "Retail",
      "laya_feasibility_probability": 0.88,
      "laya_founder_score": 9,
      "final_ai_score": 89.0,
      "ai_recommendation": "Shortlist (Top 1000)",
      "requires_human_calibration": true
    }
];

document.addEventListener('DOMContentLoaded', () => {
    updateStats();
    renderCards(candidatesData);
    setupFilters();
});

function updateStats() {
    document.getElementById('stat-total').textContent = candidatesData.length;
    
    const shortlisted = candidatesData.filter(c => c.ai_recommendation.includes('Shortlist')).length;
    document.getElementById('stat-shortlisted').textContent = shortlisted;
    
    const calibration = candidatesData.filter(c => c.requires_human_calibration).length;
    document.getElementById('stat-calibration').textContent = calibration;
}

function getScoreClass(score) {
    if (score >= 70) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
}

function getStatusInfo(candidate) {
    if (candidate.requires_human_calibration) {
        return { class: 'calibrate', text: 'Needs Calibration' };
    }
    if (candidate.ai_recommendation.includes('Shortlist')) {
        return { class: 'shortlist', text: 'Shortlisted' };
    }
    return { class: 'community', text: 'Community Route' };
}

function createCardHTML(candidate, index) {
    const scoreClass = getScoreClass(candidate.final_ai_score);
    const statusInfo = getStatusInfo(candidate);
    const actionBtn = candidate.requires_human_calibration 
        ? `<button class="action-btn primary">Calibrate</button>`
        : `<button class="action-btn">View Details</button>`;

    return `
        <div class="candidate-card glass-panel" style="animation-delay: ${index * 0.1}s">
            <div class="card-header">
                <div class="card-title">
                    <h3>${candidate.participant_id}</h3>
                </div>
                <span class="badge sector">${candidate.laya_sector}</span>
            </div>
            
            <div class="score-container">
                <div class="score-circle ${scoreClass}">
                    ${Math.round(candidate.final_ai_score)}
                </div>
                <div class="score-details">
                    <span>Feasibility: <strong>${(candidate.laya_feasibility_probability * 100).toFixed(0)}%</strong></span>
                    <span>Founder Fit: <strong>${candidate.laya_founder_score}/10</strong></span>
                </div>
            </div>

            <div class="card-footer">
                <div class="status-indicator">
                    <div class="status-dot ${statusInfo.class}"></div>
                    ${statusInfo.text}
                </div>
                ${actionBtn}
            </div>
        </div>
    `;
}

function renderCards(data) {
    const grid = document.getElementById('candidates-grid');
    grid.innerHTML = data.map((c, i) => createCardHTML(c, i)).join('');
}

function setupFilters() {
    const buttons = document.querySelectorAll('.filter-btn');
    
    buttons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Update active state
            buttons.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            // Filter logic
            const filterType = e.target.dataset.filter;
            let filteredData = candidatesData;
            
            if (filterType === 'calibration') {
                filteredData = candidatesData.filter(c => c.requires_human_calibration);
            } else if (filterType === 'shortlist') {
                filteredData = candidatesData.filter(c => c.ai_recommendation.includes('Shortlist'));
            }
            
            // Re-render with animation reset
            const grid = document.getElementById('candidates-grid');
            grid.innerHTML = '';
            setTimeout(() => renderCards(filteredData), 50);
        });
    });
}
