from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Server
    port: int = 8000

    # Supabase
    supabase_url: str
    supabase_service_role_key: str
    database_url: str

    # Neo4j Aura
    neo4j_uri: str
    neo4j_username: str
    neo4j_password: str
    neo4j_database: str | None = None

    # Pinecone (future)
    pinecone_api_key: str = ""
    pinecone_environment: str = "us-east-1"

    # Shared secret the gateway/worker send as X-Internal-Key (empty = auth disabled, dev only)
    internal_api_key: str = ""
    # Comma-separated browser origins allowed to call the AI service directly (normally none are needed)
    allowed_origins: str = "http://localhost:4000"

    # Redis (used to publish report-updates for the API Gateway's WebSocket relay)
    redis_url: str = "redis://localhost:6380"  # the compose-published dev port; override with REDIS_URL

    # LLM Keys (future)
    gemini_api_key: str = ""
    openrouter_api_key: str = ""

    class Config:
        env_file = ".env"
        extra = "ignore"  # Ignore unknown env vars like AURA_INSTANCEID


@lru_cache()
def get_settings() -> Settings:
    return Settings()
