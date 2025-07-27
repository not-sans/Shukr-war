document.addEventListener('DOMContentLoaded', () => {
    const loadingScreen = document.getElementById('loadingScreen');
    const appContainer = document.getElementById('appContainer');
    const searchInput = document.querySelector('.search-input');
    const searchButton = document.querySelector('.search-button');
    const chatDisplayArea = document.getElementById('chatDisplayArea');
    const initialContent = document.getElementById('initialContent'); // Reference to the initial greeting/cards
    const newChatButton = document.getElementById('newChatButton'); // Reference to the new chat button

    // Backend URL (ensure this matches your Flask app's host and port)
    const BACKEND_URL = 'http://127.0.0.1:5000';

    // Chat history for conversational context with the AI
    let chatHistory = [];
    let aiTypingIndicator = null; // To hold the loading message element

    // Hide loading screen and show app after a delay
    setTimeout(() => {
        loadingScreen.classList.add('hidden');
        appContainer.classList.add('loaded');
    }, 2000); // Adjust loading time as needed

    // Feature card interactions (currently just logs to console)
    const featureCards = document.querySelectorAll('.feature-card');
    featureCards.forEach(card => {
        card.addEventListener('click', () => {
            const cardTitle = card.querySelector('.card-title').textContent;
            console.log(`Feature selected: ${cardTitle}`);
            // You can add more specific actions here based on the card clicked,
            // e.g., pre-fill search input or trigger a specific backend call.
        });
    });

    // Footer navigation (visual active state)
    const footerLinks = document.querySelectorAll('.footer-nav a');
    footerLinks.forEach(link => {
        link.addEventListener('click', (event) => {
            event.preventDefault(); // Prevent default link behavior
            footerLinks.forEach(l => l.classList.remove('active')); // Remove 'active' from all links
            event.target.classList.add('active'); // Add 'active' to the clicked link
            console.log(`Navigated to: ${event.target.textContent}`);
        });
    });

    // Function to add a message bubble to the chat display area
    function addMessageToChat(message, sender) {
        const messageBubble = document.createElement('div');
        messageBubble.classList.add('message-bubble');
        messageBubble.classList.add(sender === 'user' ? 'user-message' : 'ai-message');
        messageBubble.innerHTML = formatResponse(message); // Use innerHTML for potential <br> tags
        chatDisplayArea.appendChild(messageBubble);
        chatDisplayArea.scrollTop = chatDisplayArea.scrollHeight; // Scroll to bottom
    }

    // Helper function to format response text (e.g., replace newlines for HTML display)
    function formatResponse(text) {
        // Regex to find URLs (http/https followed by non-space characters)
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        // Replace URLs with clickable links
        let formattedText = text.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer" class="chat-link">$1</a>');
        // Replace newline characters with HTML line breaks
        formattedText = formattedText.replace(/\n/g, '<br>');
        return formattedText;
    }

    // Function to show the AI typing indicator
    function showTypingIndicator() {
        if (!aiTypingIndicator) {
            aiTypingIndicator = document.createElement('div');
            aiTypingIndicator.classList.add('message-bubble', 'ai-message', 'loading');
            aiTypingIndicator.innerHTML = '<div class="loading-spinner"></div><p>FRIDAY is thinking...</p>';
            chatDisplayArea.appendChild(aiTypingIndicator);
            chatDisplayArea.scrollTop = chatDisplayArea.scrollHeight;
        }
    }

    // Function to hide the AI typing indicator
    function hideTypingIndicator() {
        if (aiTypingIndicator) {
            aiTypingIndicator.remove();
            aiTypingIndicator = null;
        }
    }

    // Function to handle and display errors from backend calls within the chat
    function handleError(message) {
        hideTypingIndicator();
        addMessageToChat(`Error: ${message}`, 'ai');
        console.error("Frontend Error:", message);
    }

    // Function to show the chat screen and hide initial content
    function showChatScreen() {
        initialContent.classList.add('hidden'); // Hide greeting and feature cards with transition
        chatDisplayArea.style.display = 'flex'; // Show chat display area (as flex container)
        chatDisplayArea.classList.add('visible'); // Add visible class for opacity transition
    }

    // Function to reset chat and show initial content
    function startNewChat() {
        chatHistory = []; // Clear chat history
        chatDisplayArea.innerHTML = ''; // Clear messages from display
        chatDisplayArea.style.display = 'none'; // Hide chat display area
        chatDisplayArea.classList.remove('visible'); // Remove visible class
        initialContent.classList.remove('hidden'); // Show greeting and feature cards with transition
        // Reset sidebar active state for "New Chat" button
        document.querySelectorAll('.icon-item').forEach(item => item.classList.remove('active'));
        newChatButton.classList.add('active'); // Keep "New Chat" button active
    }

    // Event listener for the search button click
    searchButton.addEventListener('click', async () => {
        const query = searchInput.value.trim(); // Get the trimmed value from the search input
        if (!query) {
            return; // If the query is empty, do nothing
        }

        // If this is the first message, show the chat screen
        if (chatHistory.length === 0) {
            showChatScreen();
        }

        addMessageToChat(query, 'user'); // Display user's message immediately
        showTypingIndicator(); // Show typing indicator

        // Normalize query for command matching
        const lowerCaseQuery = query.toLowerCase();

        // Regex to extract topic and optionally number of questions.
        // It now supports:
        // "create form on [topic]"
        // "create form on [number] questions [topic]"
        // "create form on [topic] with [number] questions"
        const createFormRegex = /(?:create (?:quiz|form|google form) on\s+)(?:(\d+)\s+questions\s+)?(.+?)(?:\s+with\s+(\d+)\s+questions)?$/;
        const match = lowerCaseQuery.match(createFormRegex);

        // --- Debugging Logs for Question Extraction ---
        console.log("User Query:", query);
        console.log("Lowercase Query:", lowerCaseQuery);
        console.log("Regex Match Result:", match);
        // --- End Debugging Logs ---

        let topic = '';
        let numQuestions = 5; // Default number of questions

        if (match) {
            // Determine topic and numQuestions based on which groups were captured
            if (match[1] && match[2]) { // Format: "on [num] questions [topic]"
                numQuestions = parseInt(match[1], 10);
                topic = match[2].trim();
                console.log("Matched format: 'on [num] questions [topic]'");
            } else if (match[2] && match[3]) { // Format: "on [topic] with [num] questions"
                topic = match[2].trim();
                numQuestions = parseInt(match[3], 10);
                console.log("Matched format: 'on [topic] with [num] questions'");
            } else if (match[2]) { // Format: "on [topic]" (no explicit number)
                topic = match[2].trim();
                console.log("Matched format: 'on [topic]' (defaulting to 5 questions)");
            }

            console.log("Extracted Topic:", topic); // Debug
            console.log("Extracted numQuestions:", numQuestions); // Debug

            // Ensure numQuestions is a valid positive number, otherwise default
            if (isNaN(numQuestions) || numQuestions <= 0) {
                numQuestions = 5;
                console.log("numQuestions reset to default due to invalid value:", numQuestions); // Debug
            }
            // Cap numQuestions to a reasonable maximum for API limits/performance
            if (numQuestions > 20) {
                numQuestions = 20;
                addMessageToChat("FRIDAY: For best results and to avoid API limits, I'll generate a maximum of 20 questions.", 'ai');
                console.log("numQuestions capped to:", numQuestions); // Debug
            }

            if (topic) { // Only proceed if a topic was successfully extracted
                await createQuiz(topic, numQuestions); // Call function to create a quiz
            } else {
                addMessageToChat("FRIDAY: Please specify a topic for the form (e.g., 'create form on basic maths').", 'ai');
            }
        }
        else if (lowerCaseQuery.startsWith('show responses for form ')) {
            const formId = query.substring('show responses for form '.length).trim();
            await viewFormResponses(formId); // Call function to view form responses
        } else {
            // If no specific command, treat it as a general chat query
            await sendMessageToChatbot(query);
        }

        searchInput.value = ''; // Clear the search input field after processing
    });

    // Event listener for the Enter key press in the search input
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            searchButton.click(); // Simulate a click on the search button
        }
    });

    // Event listener for the New Chat button
    newChatButton.addEventListener('click', startNewChat);

    // Function to send a message to the general chat endpoint in the Flask backend
    async function sendMessageToChatbot(message) {
        try {
            // Add the user's message to the chat history for backend context
            chatHistory.push({ role: "user", parts: [{ text: message }] });

            // Send a POST request to the /chat endpoint
            const response = await fetch(`${BACKEND_URL}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: message, history: chatHistory }) // Send current message and full history
            });

            const data = await response.json(); // Parse the JSON response from the backend

            hideTypingIndicator(); // Hide typing indicator once response is received

            if (response.ok) { // Check if the HTTP status code indicates success (2xx)
                const aiText = data.response;
                chatHistory.push({ role: "model", parts: [{ text: aiText }] }); // Add AI's response to history
                addMessageToChat(aiText, 'ai'); // Display the AI's response in the chat
            } else {
                handleError(data.error || "Failed to get response from chat bot."); // Display specific error or generic message
            }
        } catch (error) {
            handleError("Could not connect to the backend chat service."); // Handle network or other fetch errors
            console.error("Error sending message to chat bot:", error);
        }
    }

    // Function to send a request to create a Google Form quiz
    async function createQuiz(topic, numQuestions) {
        try {
            // Send a POST request to the /create_form endpoint
            const response = await fetch(`${BACKEND_URL}/create_form`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic: topic, num_questions: numQuestions })
            });

            const data = await response.json(); // Parse the JSON response

            hideTypingIndicator(); // Hide typing indicator

            if (response.ok) {
                addMessageToChat(data.response, 'ai'); // Display the success message and form URL
            } else {
                handleError(data.response || "Failed to create form."); // Display specific error or generic message
            }
        } catch (error) {
            handleError("Could not connect to the backend form creation service.");
            console.error("Error creating form:", error);
        }
    }

    // Function to send a request to view Google Form responses
    async function viewFormResponses(formId) {
        try {
            // Send a POST request to the /view_form_responses endpoint
            const response = await fetch(`${BACKEND_URL}/view_form_responses`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ form_id: formId })
            });

            const data = await response.json(); // Parse the JSON response

            hideTypingIndicator(); // Hide typing indicator

            if (response.ok) {
                addMessageToChat(data.response, 'ai'); // Display the fetched responses
            } else {
                handleError(data.response || "Failed to fetch form responses."); // Display specific error or generic message
            }
        } catch (error) {
            handleError("Could not connect to the backend form response service.");
            console.error("Error fetching form responses:", error);
        }
    }

    // Close button functionality (fades out the app container)
    const closeButton = document.querySelector('.close-button');
    closeButton.addEventListener('click', () => {
        appContainer.style.opacity = '0';
        appContainer.style.transform = 'scale(0.95)';
        setTimeout(() => {
            console.log('Application closed');
            // In a real application, you might redirect the user or close the tab
        }, 300); // Allow time for the fade-out animation
    });

    // Dynamic placeholder text typing effect for the search input
    const placeholderTexts = [
        "Can we travel at the speed of light?",
        "What's the meaning of artificial intelligence?",
        "How do neural networks work?",
        "Create a video about space exploration",
        "Generate music for my project",
        "create quiz on Python basics", // Example for forms API 
        "create form on basic maths with 10 questions", // Example for forms API
    ];

    let currentTextIndex = 0;
    let currentCharIndex = 0;
    let isDeleting = false;

    function typeText() {
        const currentText = placeholderTexts[currentTextIndex];

        if (!isDeleting) {
            searchInput.placeholder = currentText.substring(0, currentCharIndex + 1);
            currentCharIndex++;

            if (currentCharIndex === currentText.length) {
                setTimeout(() => {
                    isDeleting = true;
                }, 2000); // Pause at the end of typing
            }
        } else {
            searchInput.placeholder = currentText.substring(0, currentCharIndex - 1);
            currentCharIndex--;

            if (currentCharIndex === 0) {
                isDeleting = false;
                currentTextIndex = (currentTextIndex + 1) % placeholderTexts.length;
            }
        }

        const typingSpeed = isDeleting ? 50 : 100; // Faster deleting, slower typing
        setTimeout(typeText, typingSpeed);
    }

    // Start typing effect after initial app load
    setTimeout(typeText, 3000);

    console.log('🤖 FRIDAY AI Frontend Script Loaded Successfully! 🤖');

    // Add subtle mouse parallax effect to the floating orb
    let mouseX = 0;
    let mouseY = 0;

    document.addEventListener('mousemove', (e) => {
        mouseX = (e.clientX / window.innerWidth) * 2 - 1;
        mouseY = (e.clientY / window.innerHeight) * 2 - 1;

        const floatingOrb = document.querySelector('.floating-orb-wrapper');
        if (floatingOrb) {
            const moveX = mouseX * 5; // Adjust sensitivity for X-axis
            const moveY = mouseY * 5; // Adjust sensitivity for Y-axis
            floatingOrb.style.transform = `translate(${-50 + moveX}%, ${-50 + moveY}%)`;
        }
    });

    // Add keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Focus search input on '/' key press (if not already focused and not part of a text input)
        if (e.key === '/' && !e.ctrlKey && !e.metaKey && document.activeElement !== searchInput) {
            e.preventDefault(); // Prevent default browser search shortcut
            searchInput.focus();
        }

        // Blur search input on 'Escape' key press
        if (e.key === 'Escape') {
            searchInput.blur();
        }
    });

    // Add smooth hover animations for sidebar icons (CSS handles most of this, but JS could add more complex effects if needed)
    const sidebarIcons = document.querySelectorAll('.icon-item, .sidebar-bottom-icon');
    sidebarIcons.forEach(icon => {
        icon.addEventListener('mouseenter', () => {
            icon.style.transform = 'scale(1.05)'; // Slightly larger scale on hover
        });

        icon.addEventListener('mouseleave', () => {
            // Only revert scale if the icon is not currently active
            if (!icon.classList.contains('active')) {
                icon.style.transform = 'scale(1)';
            }
        });
    });

    // Add click ripple effect to buttons (visual feedback on click)
    function createRipple(event) {
        const button = event.currentTarget;
        const ripple = document.createElement('span'); // Create a span element for the ripple effect
        const rect = button.getBoundingClientRect(); // Get the size and position of the button
        const size = Math.max(rect.width, rect.height); // Determine the size of the ripple
        // Calculate the click position relative to the button
        const x = event.clientX - rect.left - size / 2;
        const y = event.clientY - rect.top - size / 2;

        ripple.style.cssText = `
            position: absolute;
            width: ${size}px;
            height: ${size}px;
            left: ${x}px;
            top: ${y}px;
            background: rgba(255, 255, 255, 0.4); /* White, semi-transparent ripple */
            border-radius: 50%;
            transform: scale(0); /* Start small */
            animation: ripple 0.6s linear; /* Apply the ripple animation */
            pointer-events: none; /* Ensure clicks pass through the ripple */
        `;

        // Ensure the button itself has relative position and hides overflow for the ripple
        button.style.position = 'relative';
        button.style.overflow = 'hidden';
        button.appendChild(ripple); // Add the ripple to the button

        // Remove the ripple element after its animation completes
        setTimeout(() => {
            ripple.remove();
        }, 600);
    }

    // Add ripple effect CSS (dynamically added to the document head)
    const rippleStyle = document.createElement('style');
    rippleStyle.textContent = `
        @keyframes ripple {
            to {
                transform: scale(4); /* Grow the ripple */
                opacity: 0; /* Fade out */
            }
        }
    `;
    document.head.appendChild(rippleStyle);

    // Apply the ripple effect to the search button
    document.querySelector('.search-button').addEventListener('click', createRipple);
});
