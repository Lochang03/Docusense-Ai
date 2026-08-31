import time
import google.generativeai as genai
from app.config import settings

genai.configure(api_key=settings.GEMINI_API_KEY, transport="rest")
model = genai.GenerativeModel(settings.GEMINI_MODEL)

# Simulate a realistic grounded prompt, similar size to a real chat request
fake_context = "This is sample document content. " * 200  # ~1000 words
prompt = f"""You are a document analysis assistant. Answer using ONLY this context.

CONTEXT:
{fake_context}

QUESTION:
What is this document about?

ANSWER:"""

t0 = time.time()
response = model.generate_content(prompt, request_options={"timeout": 60})
print(f"Took {time.time() - t0:.2f}s")
print(response.text[:200])