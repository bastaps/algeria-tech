# smart_engine.py
from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import json
import re

app = Flask(__name__)
# On autorise explicitement localhost:3000 (ton app) à parler à localhost:5005 (ce script)
CORS(app)

# CONFIGURATION
MODEL_NAME = "llama3.2:latest"
OLLAMA_URL = "http://localhost:11434/api/generate"

def extract_json(text):
    """Extrait proprement l'objet JSON du texte brut renvoyé par le LLM"""
    try:
        # On cherche le premier '{' et le dernier '}'
        start = text.find('{')
        end = text.rfind('}')
        if start != -1 and end != -1:
            json_str = text[start:end+1]
            return json.loads(json_str)
        return None
    except Exception as e:
        print(f"Erreur extraction JSON : {e}")
        return None

@app.route('/api/ai-generate', methods=['POST'])
def generate_aps_article():
    data = request.json
    source_text = data.get('text', '')

    if not source_text:
        return jsonify({"error": "Aucun texte source fourni"}), 400

    prompt = f"""Tu es un journaliste senior de l'Algérie Presse Service (APS), spécialisé en technologies et télécommunications algériennes. Style : Les Echos + Jeune Afrique Économie — factuel, percutant, contextualisé.

RÈGLES ABSOLUES :
- INTERDICTION TOTALE de copier des phrases du texte source — reformule tout
- Titre : headline journalistique 60-110 caractères, verbe d'action fort, angle original
- Extrait : chapeau 2-3 phrases répondant aux 5W (Qui, Quoi, Où, Quand, Pourquoi)
- Article : 4 sections ##, environ 250 mots, enrichi du contexte sectoriel algérien (ARPCE, MPT, opérateurs Djezzy/Mobilis/Ooredoo)

Réponds UNIQUEMENT avec ce JSON valide sur une seule ligne, rien d'autre :
{{"titre":"headline original","extrait":"chapeau 2-3 phrases","article":"## Introduction\\n\\n...\\n\\n## Développement\\n\\n...\\n\\n## Analyse et enjeux\\n\\n...\\n\\n## Perspectives\\n\\n..."}}

TEXTE SOURCE À TRANSFORMER (zéro copier-coller) :
{source_text}"""

    try:
        # On envoie la requête à Ollama (timeout de 300s car Llama 3.1 est lourd)
        response = requests.post(OLLAMA_URL, 
            json={
                "model": MODEL_NAME, 
                "prompt": prompt,
                "stream": False,
                "format": "json"
            }, timeout=300)
        
        response.raise_for_status()
        raw_content = response.json().get('response', '')
        
        result = extract_json(raw_content)
        
        if result:
            return jsonify(result)
        else:
            return jsonify({"error": "Le modèle n'a pas renvoyé un JSON valide"}), 500
            
    except requests.exceptions.ConnectionError:
        return jsonify({"error": "Connexion impossible avec Ollama. Vérifiez qu'il est lancé."}), 503
    except Exception as e:
        print(f"Erreur Serveur : {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    print(f"🚀 Smart Engine APS lancé sur http://localhost:5005")
    print(f"🧠 Modèle configuré : {MODEL_NAME}")
    app.run(port=5005, debug=False)