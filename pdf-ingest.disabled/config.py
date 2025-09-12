import os

class Settings(BaseSettings):
    # Define model_config to specify the source of environment variables
    model_config = SettingsConfigDict(env_file=os.environ.get("ENV_FILE", ".env"), extra='ignore')

    # Convex
    CONVEX_URL: str
    CONVEX_TOKEN: str

    # Database
    DATABASE_URL: str

    # LLM Provider
    OPENAI_API_KEY: str

    # Retry Logic
    MAX_RETRIES: int = 3
    BACKOFF_FACTOR: float = 2.0

# Create a singleton instance for easy access across the application
settings = Settings()
