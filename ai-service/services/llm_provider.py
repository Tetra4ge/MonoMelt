import os
import json
from pydantic import BaseModel
from openai import AsyncOpenAI
from core.config import get_settings

settings = get_settings()

client = AsyncOpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.environ.get("OPENROUTER_API_KEY", "dummy"),
)

async def extract_structured_data(prompt: str, response_schema: type[BaseModel], model="google/gemini-2.5-flash") -> BaseModel:
    """
    Calls the LLM via OpenRouter and forces the output to adhere to the given Pydantic schema.
    """
    try:
        # Using OpenRouter's support for JSON schema via tool calling or response_format
        response = await client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "You are an expert software architect analyzing an application graph. You must return your response strictly as JSON that matches the requested schema."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"}
        )
        content = response.choices[0].message.content
        if not content:
            raise ValueError("Empty response from LLM")
            
        # Try to parse the json and validate against schema
        data = json.loads(content)
        return response_schema(**data)
    except Exception as e:
        raise RuntimeError(f"LLM Extraction failed: {e}")
