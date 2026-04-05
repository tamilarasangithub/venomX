document.addEventListener('DOMContentLoaded', () => {
    const uploadArea = document.getElementById('upload-area');
    const imageInput = document.getElementById('imageInput');
    const uploadContent = document.getElementById('upload-content');
    const previewContent = document.getElementById('preview-content');
    const imagePreview = document.getElementById('imagePreview');
    const reselectBtn = document.getElementById('reselectBtn');
    const analyzeBtn = document.getElementById('analyzeBtn');
    
    const resultCard = document.getElementById('resultCard');
    const loadingOverlay = document.getElementById('loadingOverlay');

    let selectedFile = null;

    // Handle drag and drop
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        uploadArea.addEventListener(eventName, () => {
            uploadArea.classList.add('dragover');
        });
    });

    ['dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, () => {
            uploadArea.classList.remove('dragover');
        });
    });

    uploadArea.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files && files.length > 0) {
            handleFile(files[0]);
        }
    });

    // Handle click upload
    uploadArea.addEventListener('click', () => {
        if (!selectedFile) {
            imageInput.click();
        }
    });

    imageInput.addEventListener('change', function() {
        if (this.files && this.files.length > 0) {
            handleFile(this.files[0]);
        }
    });

    reselectBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        selectedFile = null;
        imageInput.value = '';
        uploadContent.classList.remove('hidden');
        previewContent.classList.add('hidden');
        analyzeBtn.disabled = true;
        resultCard.classList.add('hidden');
        resultCard.classList.remove('show');
    });

    function handleFile(file) {
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file');
            return;
        }

        selectedFile = file;
        
        // Show preview
        const reader = new FileReader();
        reader.onload = (e) => {
            imagePreview.src = e.target.result;
            uploadContent.classList.add('hidden');
            previewContent.classList.remove('hidden');
            analyzeBtn.disabled = false;
            
            // Hide result card if previously shown
            resultCard.classList.add('hidden');
            resultCard.classList.remove('show');
            document.getElementById('confFill').style.width = '0%';
        };
        reader.readAsDataURL(file);
    }

    // Handle Upload & Analyze
    analyzeBtn.addEventListener('click', async () => {
        if (!selectedFile) return;

        const formData = new FormData();
        formData.append('file', selectedFile);

        // Show loading overlay
        loadingOverlay.classList.remove('hidden');
        
        try {
            const response = await fetch('/predict', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Network response was not ok');
            }

            const data = await response.json();
            displayResults(data);
            
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred during analysis: ' + error.message);
        } finally {
            // Hide loading overlay
            loadingOverlay.classList.add('hidden');
        }
    });

    function displayResults(data) {
        document.getElementById('snakeLabel').innerText = data.prediction;
        
        const confPercent = (data.confidence * 100).toFixed(1);
        document.getElementById('confValue').innerText = confPercent + '%';
        
        // Show the result card
        resultCard.classList.remove('hidden');
        // Small delay to allow display:block to apply before adding transition class
        setTimeout(() => {
            resultCard.classList.add('show');
            // Animate progress bar
            document.getElementById('confFill').style.width = confPercent + '%';
        }, 50);

        // Update styling based on result
        const statusIndicator = document.getElementById('statusIndicator');
        const alertBox = document.getElementById('alertBox');
        const alertMessage = document.getElementById('alertMessage');
        const alertIcon = document.querySelector('#alertBox i');

        const isVenomous = data.prediction.toLowerCase() !== 'non-venomous';

        if (isVenomous) {
            statusIndicator.innerText = '⚠️ Venomous Detected';
            statusIndicator.className = 'status-indicator status-venomous';
            
            alertBox.className = 'alert-box'; // default is danger
            alertIcon.className = 'ph ph-warning-circle';
            alertMessage.innerHTML = `<strong>CRITICAL:</strong> Potential ${data.prediction} bite detected. Seek <strong>immediate medical attention</strong>. Administering antivenom quickly is crucial.`;
            
            // Re-color progress bar to red/orange scale
            document.getElementById('confFill').style.background = 'linear-gradient(90deg, #ef4444, #f59e0b)';
        } else {
            statusIndicator.innerText = '✓ Safe / Non-Venomous';
            statusIndicator.className = 'status-indicator status-safe';
            
            alertBox.className = 'alert-box safe';
            alertIcon.className = 'ph ph-check-circle';
            alertMessage.innerHTML = `<strong>Likely Non-Venomous.</strong> However, ANY snake bite can cause infection or allergic reaction. Monitor for unusual symptoms and clean the wound thoroughly.`;
            
            // Re-color progress bar to green scale
            document.getElementById('confFill').style.background = 'linear-gradient(90deg, #10b981, #34d399)';
        }
    }

    // --- Chatbot Functionality ---
    const chatToggle = document.getElementById('chatToggle');
    const chatWindow = document.getElementById('chatWindow');
    const chatClose = document.getElementById('chatClose');
    const chatInput = document.getElementById('chatInput');
    const sendMsgBtn = document.getElementById('sendMsgBtn');
    const chatMessages = document.getElementById('chatMessages');
    const findHospitalBtn = document.getElementById('findHospitalBtn');

    if (chatToggle && chatWindow && chatClose) {
        chatToggle.addEventListener('click', () => {
            chatWindow.classList.remove('hidden');
            chatToggle.style.display = 'none';
        });

        chatClose.addEventListener('click', () => {
            chatWindow.classList.add('hidden');
            chatToggle.style.display = 'flex';
        });
    }

    function addMessage(text, sender, isHTML = false) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${sender}`;
        
        const p = document.createElement('p');
        if (isHTML) {
            p.innerHTML = text;
        } else {
            p.innerText = text;
        }
        
        msgDiv.appendChild(p);
        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    async function sendMessage(text) {
        if (!text.trim()) return;
        
        addMessage(text, 'user');
        chatInput.value = '';
        
        try {
            const response = await fetch('/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text })
            });

            const data = await response.json();
            
            if (data.response) {
                addMessage(data.response, 'bot', true);
            } else if (data.error) {
                addMessage("Error: " + data.error, 'bot');
            }
            
        } catch (error) {
            console.error("Chat error:", error);
            addMessage("Sorry, I'm having trouble connecting to the server.", 'bot');
        }
    }

    if (sendMsgBtn && chatInput) {
        sendMsgBtn.addEventListener('click', () => sendMessage(chatInput.value));
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage(chatInput.value);
            }
        });
    }

    if (findHospitalBtn) {
        findHospitalBtn.addEventListener('click', () => {
            addMessage('Finding nearest hospital...', 'user');
            
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const lat = position.coords.latitude;
                        const lng = position.coords.longitude;
                        const mapsUrl = `https://www.google.com/maps/search/nearest+hospital/@${lat},${lng},15z`;
                        addMessage(`I found your location. <a href="${mapsUrl}" target="_blank" style="color: #93c5fd; text-decoration: underline;">Click here to see nearest hospitals on Google Maps</a>.`, 'bot', true);
                    },
                    (error) => {
                        console.warn("Geolocation error:", error);
                        addMessage("I couldn't access your location. Please click <a href='https://www.google.com/maps/search/nearest+hospital/' target='_blank' style='color: #93c5fd; text-decoration: underline;'>here to search Google Maps</a> for nearby hospitals.", 'bot', true);
                    }
                );
            } else {
                addMessage("Your browser doesn't support geolocation. Click <a href='https://www.google.com/maps/search/nearest+hospital/' target='_blank' style='color: #93c5fd; text-decoration: underline;'>here to search on Google Maps</a>.", 'bot', true);
            }
        });
    }
});
