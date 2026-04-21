const messagesContainer = document.getElementById('messagesContainer');
const messageForm = document.getElementById('messageForm');
const messageInput = document.getElementById('messageInput');
const chips = document.querySelectorAll('.chip');
const clearChatButton = document.getElementById('clearChatButton');
const sendButton = document.getElementById('sendButton');
const suggestionsList = document.getElementById('suggestionsList');

const statusBadge = document.getElementById('statusBadge');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const tokensBadge = document.getElementById('tokensBadge');
const tokensText = document.getElementById('tokensText');
const assistantSubtitle = document.getElementById('assistantSubtitle');

const STORAGE_KEY = 'matias_chat_history';
const TOKENS_STORAGE_KEY = 'matias_chat_tokens';
const INITIAL_TOKENS = 990;

let availableTokens = loadTokens();

const globalSuggestions = [
    'Explícame algo simple',
    'Dame ideas para aprender IA',
    'Ayúdame a organizar mi día',
    'Cuéntame un chiste',
    '¿Qué hora es?',
    '¿Cuál es la fecha de hoy?',
    'Dame una motivación corta',
    'Haz una suma: 18 + 24'
];

document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    loadChatHistory();
    renderSuggestions(globalSuggestions);
    updateTokenUI();

    if (!hasStoredMessages()) {
        showWelcomeMessages();
    }
});

function setupEventListeners() {
    messageForm.addEventListener('submit', handleSendMessage);

    chips.forEach(chip => {
        if (chip.id !== 'clearChatButton') {
            chip.addEventListener('click', handleChipClick);
        }
    });

    if (clearChatButton) {
        clearChatButton.addEventListener('click', clearChat);
    }
}

function hasStoredMessages() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return false;

    try {
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) && parsed.length > 0;
    } catch (e) {
        return false;
    }
}

function showWelcomeMessages() {
    const initialMessages = [
        {
            type: 'assistant',
            text: 'Hola, soy Matías Chat Box. Soy un asistente de prueba con respuestas automáticas y sugerencias para ayudarte a empezar.',
            time: getCurrentTime()
        },
        {
            type: 'assistant',
            text: 'Puedo responder saludos, hora, fecha, operaciones simples, ideas rápidas y algunos mensajes generales. Si no entiendo algo, igual intentaré orientarte con sugerencias.',
            time: getCurrentTime()
        }
    ];

    initialMessages.forEach(message => {
        addMessage(message.type, message.text, message.time, false);
    });

    saveChatHistory();
}

function handleSendMessage(e) {
    e.preventDefault();

    const text = messageInput.value.trim();
    if (!text) return;

    if (availableTokens <= 0) {
        updateTokenUI();
        return;
    }

    const tokenCost = calculateTokenCost(text);

    if (tokenCost > availableTokens) {
        addMessage('assistant', 'No quedan tokens suficientes para procesar ese mensaje. El chat quedó pausado.', getCurrentTime());
        availableTokens = 0;
        updateTokenUI();
        return;
    }

    addMessage('user', text, getCurrentTime());
    consumeTokens(text);

    messageInput.value = '';

    if (availableTokens <= 0) {
        addMessage('assistant', 'Se agotaron los tokens. Chat pausado.', getCurrentTime());
        return;
    }

    messageInput.focus();
    setLoadingState(true);
    const typingId = addTypingIndicator();

    setTimeout(() => {
        removeTypingIndicator(typingId);

        const responseData = getAssistantResponse(text);
        addMessage('assistant', responseData.text, getCurrentTime());

        if (responseData.suggestions && responseData.suggestions.length > 0) {
            renderSuggestions(responseData.suggestions);
        } else {
            renderSuggestions(globalSuggestions);
        }

        setLoadingState(false);
        updateTokenUI();
    }, 650 + Math.random() * 700);
}

function handleChipClick(e) {
    const query = e.currentTarget.getAttribute('data-query');
    if (!query) return;

    if (availableTokens <= 0) {
        updateTokenUI();
        return;
    }

    messageInput.value = query;
    messageInput.focus();
    messageForm.requestSubmit();
}

function addMessage(type, text, time, shouldSave = true) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;

    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = 'message-bubble';
    bubbleDiv.innerHTML = `
        <div>${escapeHtml(text)}</div>
        <div class="message-time">${time}</div>
    `;

    messageDiv.appendChild(bubbleDiv);
    messagesContainer.appendChild(messageDiv);

    scrollToBottom();

    if (shouldSave) {
        saveChatHistory();
    }
}

function addTypingIndicator() {
    const typingId = 'typing-' + Date.now();

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message assistant';
    messageDiv.id = typingId;

    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = 'message-bubble';

    bubbleDiv.innerHTML = `
        <div class="typing-bubble">
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
        </div>
        <div class="message-time">escribiendo...</div>
    `;

    messageDiv.appendChild(bubbleDiv);
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();

    return typingId;
}

function removeTypingIndicator(typingId) {
    const typingElement = document.getElementById(typingId);
    if (typingElement) {
        typingElement.remove();
    }
}

function setLoadingState(isLoading) {
    if (availableTokens <= 0) {
        messageInput.disabled = true;
        sendButton.disabled = true;
        return;
    }

    sendButton.disabled = isLoading;
    messageInput.disabled = isLoading;
}

function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function getAssistantResponse(userText) {
    const text = userText.toLowerCase().trim();

    if (['hola', 'hi', 'hey', 'buenos días', 'buenas tardes', 'buenas noches'].some(word => text.includes(word))) {
        return {
            text: pickRandom([
                '¡Hola! Estoy listo para ayudarte. Puedes preguntarme algo o usar una sugerencia.',
                'Hola. ¿Qué quieres hacer ahora? También puedo proponerte algunas ideas.',
                '¡Hola! Dime qué necesitas y te respondo dentro de lo que sé hacer en este modo demo.'
            ]),
            suggestions: ['¿Qué hora es?', '¿Cuál es la fecha de hoy?', 'Ayúdame a organizar mi día']
        };
    }

    if (['hora', 'qué hora es', 'que hora es', 'horario'].some(word => text.includes(word))) {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');

        return {
            text: 'La hora actual es ' + hours + ':' + minutes,
            suggestions: ['¿Cuál es la fecha de hoy?', 'Cuéntame un chiste', 'Dame una motivación corta']
        };
    }

    if (['fecha', 'cuál es la fecha', 'cual es la fecha', 'día', 'hoy'].some(word => text.includes(word))) {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const date = new Date().toLocaleDateString('es-ES', options);

        return {
            text: 'Hoy es ' + date,
            suggestions: ['¿Qué hora es?', 'Ayúdame a organizar mi día', 'Dame ideas para aprender IA']
        };
    }

    if (['clima', 'tiempo', 'lluvia', 'temperatura', 'nublado', 'soleado'].some(word => text.includes(word))) {
        return {
            text: 'No tengo conexión a datos en tiempo real, así que no puedo decirte el clima actual. Pero puedo ayudarte con otras consultas de prueba o sugerirte opciones útiles.',
            suggestions: ['¿Qué hora es?', '¿Cuál es la fecha de hoy?', 'Dame una motivación corta']
        };
    }

    if (text.includes('+') || (text.includes('-') && !text.includes('--')) || text.includes('*') || text.includes('/')) {
        const result = evaluateSimpleMath(text);

        if (result !== null) {
            return {
                text: 'El resultado es: ' + result,
                suggestions: ['Haz otra suma: 42 + 8', 'Haz otra resta: 100 - 35', 'Cuéntame un chiste']
            };
        }
    }

    if (['chiste', 'hazme reír', 'cuento algo gracioso'].some(word => text.includes(word))) {
        return {
            text: pickRandom([
                'Claro: ¿Cuál es el café más peligroso del mundo? El ex-preso. 😌',
                'Ahí va uno: programar sin probar es como lanzarse en paracaídas para ver si abre.',
                'Uno simple: mi modo demo no sabe todo, pero al menos no invento facturas.'
            ]),
            suggestions: ['Dame otro chiste', 'Dame una motivación corta', 'Ayúdame a organizar mi día']
        };
    }

    if (['motívame', 'motivación', 'animo', 'ánimo'].some(word => text.includes(word))) {
        return {
            text: pickRandom([
                'Haz lo que sirve, aunque no tengas ganas. La disciplina vale más que el impulso.',
                'No necesitas sentirte listo. Necesitas empezar.',
                'Tu avance real empieza cuando dejas de adornar y comienzas a ejecutar.'
            ]),
            suggestions: ['Dame otra motivación', 'Ayúdame a organizar mi día', 'Dame ideas para aprender IA']
        };
    }

    if (['organizar mi día', 'organiza mi día', 'plan del día', 'rutina'].some(word => text.includes(word))) {
        return {
            text: 'Te propongo algo simple: 1) define una tarea clave, 2) hazla primero, 3) elimina distracciones 60 minutos, 4) pausa corta, 5) segunda tarea importante. Si quieres, puedo ayudarte a convertir eso en una rutina más concreta.',
            suggestions: ['Hazme una rutina simple', 'Dame una motivación corta', 'Dame ideas para aprender IA']
        };
    }

    if (['ia', 'inteligencia artificial', 'aprender ia'].some(word => text.includes(word))) {
        return {
            text: 'Para aprender IA sin perder tiempo: empieza por prompting, luego automatización, luego APIs y finalmente casos reales. Si solo consumes teoría, te estancas. Hay que construir cosas.',
            suggestions: ['Dame una ruta de estudio', 'Ayúdame a organizar mi día', 'Explícame algo simple']
        };
    }

    if (['ruta de estudio', 'plan de estudio'].some(word => text.includes(word))) {
        return {
            text: 'Ruta simple: semana 1 prompting, semana 2 herramientas no-code, semana 3 automatizaciones, semana 4 integrar una API, semana 5 proyecto real, semana 6 mejorar y documentar. Menos cursos eternos, más práctica.',
            suggestions: ['Dame ideas para aprender IA', 'Hazme una rutina simple', 'Explícame algo simple']
        };
    }

    if (['explícame algo simple', 'explicame algo simple'].some(word => text.includes(word))) {
        return {
            text: 'Algo simple: una IA de chat no “piensa” como una persona. Predice qué texto viene después según patrones. Lo útil no es romantizarla, sino usarla bien.',
            suggestions: ['Dame otro concepto simple', 'Dame ideas para aprender IA', 'Cuéntame un chiste']
        };
    }

    if (['dólar', 'dolar', 'precio del dólar', 'precio del dolar', 'cotización del dólar'].some(word => text.includes(word))) {
        return {
            text: 'No puedo consultar el valor del dólar en tiempo real en este modo demo. Si después conectas una API, eso se puede resolver de verdad.',
            suggestions: ['¿Qué hora es?', '¿Cuál es la fecha de hoy?', 'Explícame algo simple']
        };
    }

    return {
        text: pickRandom([
            'No tengo una respuesta exacta para eso en este modo de prueba, pero puedo orientarte con otra consulta más simple.',
            'No entendí del todo tu mensaje. Reformúlalo o usa una sugerencia de abajo.',
            'Eso sale de mis respuestas automáticas actuales. Aun así, puedo ayudarte con hora, fecha, operaciones simples, ideas o mensajes guía.'
        ]),
        suggestions: ['¿Qué hora es?', '¿Cuál es la fecha de hoy?', 'Explícame algo simple', 'Dame ideas para aprender IA']
    };
}

function renderSuggestions(items) {
    suggestionsList.innerHTML = '';

    items.forEach(item => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'suggestion-btn';
        button.textContent = item;

        button.addEventListener('click', () => {
            if (availableTokens <= 0) {
                updateTokenUI();
                return;
            }

            messageInput.value = item;
            messageInput.focus();
            messageForm.requestSubmit();
        });

        suggestionsList.appendChild(button);
    });
}

function evaluateSimpleMath(expression) {
    try {
        if (!/^[\d+\-*/().\s:]+$/.test(expression)) {
            const cleanedExpression = expression.replace(/[^0-9+\-*/().\s]/g, '');
            if (!cleanedExpression) return null;
            expression = cleanedExpression;
        }

        const result = new Function('return ' + expression)();

        if (typeof result !== 'number' || !isFinite(result)) {
            return null;
        }

        return Number.isInteger(result) ? result : Number(result.toFixed(2));
    } catch (e) {
        return null;
    }
}

function saveChatHistory() {
    const messages = [];

    document.querySelectorAll('.message').forEach(message => {
        const bubble = message.querySelector('.message-bubble');
        const time = message.querySelector('.message-time');

        if (!bubble || !time) return;

        const clonedBubble = bubble.cloneNode(true);
        const timeElement = clonedBubble.querySelector('.message-time');

        if (timeElement) {
            timeElement.remove();
        }

        const text = clonedBubble.textContent.trim();

        if (!text || text === 'escribiendo...') return;

        let type = 'assistant';
        if (message.classList.contains('user')) {
            type = 'user';
        } else if (message.classList.contains('system')) {
            type = 'system';
        }

        messages.push({
            type: type,
            text: text,
            time: time.textContent.trim()
        });
    });

    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
}

function loadChatHistory() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;

    try {
        const messages = JSON.parse(stored);

        if (!Array.isArray(messages)) return;

        messagesContainer.innerHTML = '';

        messages.forEach(message => {
            addMessage(message.type, message.text, message.time, false);
        });

        scrollToBottom();
    } catch (e) {
        localStorage.removeItem(STORAGE_KEY);
    }
}

function clearChat() {
    messagesContainer.innerHTML = '';
    localStorage.removeItem(STORAGE_KEY);

    availableTokens = INITIAL_TOKENS;
    saveTokens();
    updateTokenUI();

    messageInput.placeholder = 'Escribe tu mensaje...';
    renderSuggestions(globalSuggestions);
    showWelcomeMessages();
}

function loadTokens() {
    const stored = localStorage.getItem(TOKENS_STORAGE_KEY);
    const parsed = Number(stored);

    if (!stored || isNaN(parsed) || parsed < 0) {
        localStorage.setItem(TOKENS_STORAGE_KEY, String(INITIAL_TOKENS));
        return INITIAL_TOKENS;
    }

    return parsed;
}

function saveTokens() {
    localStorage.setItem(TOKENS_STORAGE_KEY, String(availableTokens));
}

function calculateTokenCost(text) {
    const cleanText = text.trim();
    if (!cleanText) return 0;

    const baseCost = 12;
    const extraCost = Math.ceil(cleanText.length / 12);

    return baseCost + extraCost;
}

function consumeTokens(userText) {
    const cost = calculateTokenCost(userText);
    availableTokens -= cost;

    if (availableTokens < 0) {
        availableTokens = 0;
    }

    updateTokenUI();
}

function updateTokenUI() {
    if (availableTokens > 0) {
        tokensText.textContent = availableTokens + ' tokens';
        statusText.textContent = 'Online';
        assistantSubtitle.textContent = 'Asistente local de prueba';

        statusDot.classList.add('online');
        statusDot.classList.remove('offline');

        statusBadge.classList.remove('paused');
        tokensBadge.classList.remove('empty');

        messageInput.disabled = false;
        sendButton.disabled = false;

        if (messageInput.placeholder === 'No quedan tokens...') {
            messageInput.placeholder = 'Escribe tu mensaje...';
        }
    } else {
        availableTokens = 0;
        tokensText.textContent = 'No quedan tokens';
        statusText.textContent = 'Chat pausado';
        assistantSubtitle.textContent = 'Sin tokens disponibles';

        statusDot.classList.remove('online');
        statusDot.classList.add('offline');

        statusBadge.classList.add('paused');
        tokensBadge.classList.add('empty');

        messageInput.disabled = true;
        sendButton.disabled = true;
        messageInput.placeholder = 'No quedan tokens...';
    }

    saveTokens();
}

function getCurrentTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return hours + ':' + minutes;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function pickRandom(items) {
    return items[Math.floor(Math.random() * items.length)];
}