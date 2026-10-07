import json

class StartupFiltrationSystem:
    def __init__(self):
        self.participants = {}
        self.submissions = []
        
    def ingest_whatsapp_data(self, participant_id, conversation_logs):
        """Mock ingestion of WhatsApp chatbot data."""
        # Extract problem statement from conversation (Mocked)
        problem_statement = conversation_logs.get('problem_statement', '')
        self.participants[participant_id] = {
            'problem': problem_statement,
            'module_completed': False,
            'solution_brief': None
        }
        print(f"[WhatsApp] Captured idea from {participant_id}")

    def submit_solution_brief(self, participant_id, brief_data):
        """Filter 1: Effort-based qualification."""
        if participant_id in self.participants:
            self.participants[participant_id]['module_completed'] = True
            self.participants[participant_id]['solution_brief'] = brief_data
            self.submissions.append(participant_id)
            print(f"[Filter 1] {participant_id} completed module and submitted brief.")
        else:
            print(f"[Error] Participant {participant_id} not found in system.")

    def laya_decision_engine(self, brief_data):
        """
        Filter 2: Laya AI-Scored Evaluation via API.
        Makes an HTTP request to the Laya model inference endpoint to get structured primitive outputs.
        """
        api_url = "https://api.your-laya-endpoint.com/v1/decide" # Replace with actual Laya API URL
        api_key = "YOUR_API_KEY" # Replace with actual API key
        
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        
        # Define the primitives we want Laya to return
        payload = {
            "input_text": f"Problem Validation: {brief_data.get('problem_validation', '')}\nFounder Fit: {brief_data.get('founder_fit', '')}\nSolution Concept: {brief_data.get('solution_concept', '')}",
            "decisions": [
                {
                    "name": "meets_baseline",
                    "type": "null", 
                    "description": "Does the idea meet the baseline feasibility threshold?"
                },
                {
                    "name": "founder_fit_score",
                    "type": "score",
                    "range": [1, 10],
                    "description": "Rate the founder's connection and fit to the problem from 1 to 10."
                },
                {
                    "name": "sector",
                    "type": "choice",
                    "options": ["Agriculture", "Technology", "Retail", "Other"],
                    "description": "Categorize the startup's domain or sector."
                }
            ]
        }
        
        try:
            # Uncomment the lines below to make the real API request
            # import requests
            # response = requests.post(api_url, json=payload, headers=headers)
            # response.raise_for_status()
            # result = response.json()
            
            # Simulated API Response (Mocking the expected structure from Laya API)
            result = {
                "decisions": {
                    "meets_baseline": {"probability": 0.9 if len(brief_data.get('problem_validation', '')) > 50 else 0.2},
                    "founder_fit_score": {"value": 8 if "farmer" in str(brief_data.get('founder_fit', '')).lower() else 3},
                    "sector": {"value": "Agriculture" if "farm" in str(brief_data.get('solution_concept', '')).lower() else "Other"}
                }
            }
            
            # Extract primitive results
            feasibility_prob = result["decisions"]["meets_baseline"]["probability"]
            meets_baseline = feasibility_prob > 0.5
            founder_fit_score = result["decisions"]["founder_fit_score"]["value"]
            assigned_sector = result["decisions"]["sector"]["value"]
            
            total_score = (feasibility_prob * 50) + (founder_fit_score * 5)
            
            return {
                'laya_feasibility_prob': feasibility_prob,
                'laya_founder_score': founder_fit_score,
                'laya_sector': assigned_sector,
                'total_score': total_score,
                'recommendation': 'Shortlist (Top 1000)' if meets_baseline and total_score >= 60 else 'Community',
                'bias_flag': total_score > 85 # Flag for human jury calibration
            }
            
        except Exception as e:
            print(f"[API Error] Failed to call Laya model: {e}")
            return None


    def process_cohort(self):
        """Process all submissions through the Laya engine for Jury Dashboard."""
        jury_dashboard = []
        for pid in self.submissions:
            brief = self.participants[pid]['solution_brief']
            evaluation = self.laya_decision_engine(brief)
            
            jury_dashboard.append({
                'participant_id': pid,
                'laya_sector': evaluation['laya_sector'],
                'laya_feasibility_probability': evaluation['laya_feasibility_prob'],
                'laya_founder_score': evaluation['laya_founder_score'],
                'final_ai_score': evaluation['total_score'],
                'ai_recommendation': evaluation['recommendation'],
                'requires_human_calibration': evaluation['bias_flag']
            })
            
        return jury_dashboard


if __name__ == "__main__":
    system = StartupFiltrationSystem()
    
    print("--- Simulating ShuruKar Bihar Pilot Funnel ---")
    
    # 1. WhatsApp Ingestion (Top of funnel - 15,000 users)
    system.ingest_whatsapp_data("PT_001", {"problem_statement": "Lack of cold storage in rural Bihar."})
    system.ingest_whatsapp_data("PT_002", {"problem_statement": "Need a better way to buy seeds."})
    
    print("\n--- Processing Filter 1 ---")
    # 2. Filter 1: Solution Brief Submission (Self-selection through effort)
    system.submit_solution_brief("PT_001", {
        "problem_validation": "Interviewed 50 farmers who lose 30% of their yield due to lack of cold storage.",
        "founder_fit": "I am a farmer's son with an engineering degree.",
        "solution_concept": "Solar-powered micro cold storage units that can be installed on farms."
    })
    
    system.submit_solution_brief("PT_002", {
        "problem_validation": "Seeds are expensive.",
        "founder_fit": "I like farming.",
        "solution_concept": "An app to buy seeds."
    })
    
    print("\n--- Processing Filter 2 (AI Evaluation) ---")
    # 3. Filter 2: AI Scoring for Jury (Segregating to 1,000 teams)
    dashboard = system.process_cohort()
    
    print("\n--- District Jury Dashboard Output ---")
    print(json.dumps(dashboard, indent=2))
