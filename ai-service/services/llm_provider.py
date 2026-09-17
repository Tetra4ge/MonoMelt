import os
import json
import logging
from pydantic import BaseModel
from openai import AsyncOpenAI
import google.generativeai as genai
from core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

client = AsyncOpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.environ.get("OPENROUTER_API_KEY", "dummy"),
)

async def _extract_via_openrouter(prompt: str, model: str) -> str:
    response = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": "You are an expert software architect analyzing an application graph. You must return your response strictly as JSON that matches the requested schema. Do not include markdown code blocks, just raw JSON."},
            {"role": "user", "content": prompt}
        ],
        response_format={"type": "json_object"}
    )
    return response.choices[0].message.content

async def _extract_via_gemini_fallback(prompt: str, model: str) -> str:
    # Ensure Gemini uses a model name that Google's SDK expects (e.g. drop the "google/" prefix)
    gemini_model_name = "gemini-2.5-flash" if "gemini-2.5-flash" in model else "gemini-1.5-pro"
    
    genai.configure(api_key=os.environ.get("GEMINI_API_KEY", "dummy"))
    gemini_model = genai.GenerativeModel(
        model_name=gemini_model_name,
        system_instruction="You are an expert software architect analyzing an application graph. You must return your response strictly as JSON that matches the requested schema. Do not include markdown code blocks, just raw JSON."
    )
    
    # Gemini SDK generates synchronously by default, but we'll use generate_content_async if available
    try:
        response = await gemini_model.generate_content_async(
            prompt,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json",
            )
        )
        return response.text
    except AttributeError:
        # Fallback for older SDK versions without generate_content_async
        import asyncio
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None, 
            lambda: gemini_model.generate_content(
                prompt,
                generation_config=genai.GenerationConfig(response_mime_type="application/json")
            )
        )
        return response.text


async def extract_structured_data(prompt: str, response_schema: type[BaseModel], model="google/gemini-2.5-flash") -> BaseModel:
    """
    Calls the LLM via OpenRouter. If OpenRouter fails, falls back to direct Gemini API.
    Forces the output to adhere to the given Pydantic schema.
    """
    content = None
    schema_str = response_schema.schema_json()
    prompt = f"{prompt}\n\nIMPORTANT: You MUST return a valid JSON object adhering exactly to this JSON schema:\n{schema_str}"
    
    try:
        logger.info(f"Attempting LLM extraction via OpenRouter using {model}...")
        content = await _extract_via_openrouter(prompt, model)
    except Exception as e:
        logger.warning(f"OpenRouter extraction failed: {e}. Attempting direct Gemini fallback...")
        try:
            content = await _extract_via_gemini_fallback(prompt, model)
            logger.info("Direct Gemini fallback succeeded.")
        except Exception as fallback_err:
            raise RuntimeError(f"Both OpenRouter and Gemini Fallback failed. Final error: {fallback_err}")
            
    if not content:
        raise ValueError("Empty response from LLM")
        
    try:
        # Clean up any potential markdown code block artifacts if LLM ignores instructions
        content = content.strip()
        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
            
        data = json.loads(content.strip())
        if isinstance(data, list):
            data = {"findings": data}
        return response_schema(**data)
    except Exception as e:
        raise RuntimeError(f"Failed to parse LLM JSON response against schema: {e}\nRaw Content: {content}")

class ContentResponse:
    def __init__(self, text: str):
        self.text = text

async def generate_content(prompt: str, model="google/gemini-2.5-flash") -> ContentResponse:
    """
    Calls the LLM via OpenRouter for standard text generation.
    Returns an object with a .text attribute.
    """
    try:
        response = await client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}]
        )
        return ContentResponse(response.choices[0].message.content)
    except Exception as e:
        logger.warning(f"OpenRouter text generation failed: {e}. Attempting direct Gemini fallback...")
        gemini_model_name = "gemini-2.5-flash" if "gemini-2.5-flash" in model else "gemini-1.5-pro"
        genai.configure(api_key=os.environ.get("GEMINI_API_KEY", "dummy"))
        gemini_model = genai.GenerativeModel(model_name=gemini_model_name)
        try:
            response = await gemini_model.generate_content_async(prompt)
            return ContentResponse(response.text)
        except AttributeError:
            import asyncio
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None, 
                lambda: gemini_model.generate_content(prompt)
            )
            return ContentResponse(response.text)
