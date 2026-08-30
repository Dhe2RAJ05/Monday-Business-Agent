import streamlit as st
import os
from dotenv import load_dotenv

# Load env before importing agent to ensure keys are available
load_dotenv()

from agent import BIAgent

st.set_page_config(
    page_title="Monday.com BI Agent",
    page_icon="📊",
    layout="wide"
)

st.title("📊 Monday.com Business Intelligence Agent")
st.markdown("Ask me anything about your Work Orders or Sales Pipeline!")

# Check for API keys
if not os.environ.get("MONDAY_API_TOKEN") or not os.environ.get("GEMINI_API_KEY"):
    st.error("⚠️ Missing API Keys! Please check your `.env` file and ensure `MONDAY_API_TOKEN` and `GEMINI_API_KEY` are set.")
    st.stop()

# Initialize session state for agent and messages
if "agent" not in st.session_state:
    try:
        st.session_state.agent = BIAgent()
    except Exception as e:
        st.error(f"Failed to initialize AI Agent: {e}")
        st.stop()
        
if "messages" not in st.session_state:
    st.session_state.messages = [
        {"role": "assistant", "content": "Hello! I am your AI Business Intelligence Agent. How can I help you analyze your Monday.com boards today?"}
    ]

# Sidebar
with st.sidebar:
    st.header("Quick Actions")
    if st.button("📈 Generate Leadership Update", use_container_width=True):
        # Programmatically send a request for leadership update
        st.session_state.messages.append({"role": "user", "content": "Please generate a comprehensive leadership update."})
        with st.spinner("Compiling leadership update..."):
            response = st.session_state.agent.send_message("Please generate a comprehensive leadership update based on all available data.")
        st.session_state.messages.append({"role": "assistant", "content": response})

# Display chat history
for msg in st.session_state.messages:
    st.chat_message(msg["role"]).write(msg["content"])

# Chat input
if prompt := st.chat_input("Ask a question about your business data..."):
    # Add user message
    st.session_state.messages.append({"role": "user", "content": prompt})
    st.chat_message("user").write(prompt)
    
    # Get agent response
    with st.chat_message("assistant"):
        with st.spinner("Analyzing data..."):
            response = st.session_state.agent.send_message(prompt)
            st.write(response)
            
    # Add assistant message to history
    st.session_state.messages.append({"role": "assistant", "content": response})
