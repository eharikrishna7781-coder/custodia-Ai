import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

function getMimeTypeFromBase64(base64Data) {
  if (base64Data.startsWith('data:')) {
    const match = base64Data.match(/data:([^;]+);base64,/);
    if (match) return match[1];
  }
  // Default to JPEG if no prefix
  return 'image/jpeg';
}

function stripBase64Prefix(base64Data) {
  if (base64Data.startsWith('data:')) {
    return base64Data.split(',')[1];
  }
  return base64Data;
}

function extractJsonPayload(text) {
  if (!text) return null;
  const cleaned = text.replace(/```json|```/gi, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch (_) {
      return null;
    }
  }
  try {
    return JSON.parse(cleaned);
  } catch (_) {
    return null;
  }
}

// Keywords that indicate emergency conditions
const EMERGENCY_KEYWORDS = [
  'snake bite', 'snakebite', 'venomous', 'critical', 'severe bleeding',
  'unconscious', 'not breathing', 'cardiac arrest', 'severe burn',
  'fracture', 'broken bone', ' profuse bleeding', 'deep wound',
  'allergic reaction', 'anaphylaxis', 'poisoning', 'overdose',
  'seizure', 'stroke', 'heart attack', 'drowning', 'electrocution'
];

function checkEmergency(condition, severity, recommendation) {
  const text = `${condition || ''} ${severity || ''} ${recommendation || ''}`.toLowerCase();
  return EMERGENCY_KEYWORDS.some(keyword => text.includes(keyword.toLowerCase()));
}

// Fallback analysis based on image characteristics (file name hints, etc.)
function fallbackAnalysis(imageData) {
  // Try to detect from base64 size/patterns (very basic heuristic)
  return {
    condition: 'Unable to analyze - please describe symptoms',
    severity: 'unknown',
    recommendation: 'Please consult a healthcare professional for proper diagnosis.',
    first_aid: 'If this is an emergency, seek immediate medical attention.',
    emergency: false,
    confidence: 0,
  };
}

export async function analyzeImage(imageData) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === 'your_api_key_here') {
    console.warn('GEMINI_API_KEY not configured, using fallback analysis');
    return {
      condition: 'Analysis unavailable - API key not configured',
      severity: 'unknown',
      recommendation: 'Please configure GEMINI_API_KEY for AI-powered image analysis. Describe your symptoms instead.',
      first_aid: 'If this is an emergency, seek immediate medical attention.',
      emergency: false,
      confidence: 0,
      note: 'AI analysis requires API key configuration',
    };
  }

  try {
    const mimeType = getMimeTypeFromBase64(imageData);
    const base64Content = stripBase64Prefix(imageData);

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `You are a medical image analysis assistant for rural healthcare in India.

Analyze the provided medical image carefully. Consider common rural health conditions including:
- Skin conditions (rashes, infections, allergic reactions)
- Wounds, cuts, abrasions, lacerations
- Snake bites or insect bites
- Burns (thermal, chemical, electrical)
- Swelling, inflammation, or abnormal growths
- Eye conditions (redness, injury)
- Dental issues
- Fractures or dislocations (if visible)

Return ONLY a valid JSON object with this exact structure:
{
  "condition": "Clear, specific description of what you observe (in simple language)",
  "severity": "One of: mild, moderate, severe, critical",
  "recommendation": "Specific actionable medical recommendation",
  "first_aid": "Immediate first aid steps if applicable",
  "emergency": true/false,
  "confidence": 0-100 (your confidence in this assessment),
  "possible_conditions": ["list of 2-3 possible conditions"],
  "seek_care": "When and where to seek medical care"
}

Important guidelines:
- Use simple, clear language suitable for rural patients
- Flag as emergency=true for any life-threatening condition
- Be specific about first aid steps
- Include confidence score to indicate uncertainty
- If uncertain, recommend professional medical evaluation`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Content,
          mimeType: mimeType,
        },
      },
    ]);

    const response = result.response.text();
    const parsed = extractJsonPayload(response);

    if (parsed && parsed.condition) {
      // Validate and sanitize the response
      const isEmergency = parsed.emergency === true ||
        checkEmergency(parsed.condition, parsed.severity, parsed.recommendation);

      return {
        condition: parsed.condition || 'Unknown condition',
        severity: parsed.severity || 'unknown',
        recommendation: parsed.recommendation || 'Please consult a healthcare professional.',
        first_aid: parsed.first_aid || 'Seek medical attention if concerned.',
        emergency: isEmergency,
        confidence: parsed.confidence || 50,
        possible_conditions: parsed.possible_conditions || [],
        seek_care: parsed.seek_care || 'Consult nearest healthcare provider.',
      };
    }

    // If parsing failed but we got a response, try to extract useful info
    if (response) {
      const isEmergency = checkEmergency(response, '', '');
      return {
        condition: 'Analysis completed - see details',
        severity: isEmergency ? 'critical' : 'unknown',
        recommendation: response.substring(0, 500),
        first_aid: 'Please consult a healthcare professional for proper diagnosis.',
        emergency: isEmergency,
        confidence: 30,
        possible_conditions: [],
        seek_care: 'Consult nearest healthcare provider.',
      };
    }

    return fallbackAnalysis(imageData);

  } catch (error) {
    console.error('Image analysis error:', error);
    return {
      condition: 'Analysis error',
      severity: 'unknown',
      recommendation: 'Unable to analyze image at this time. Please describe your symptoms instead.',
      first_aid: 'If this is an emergency, seek immediate medical attention.',
      emergency: false,
      confidence: 0,
      error: error.message,
    };
  }
}

export default analyzeImage;
