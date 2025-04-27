// Handle form submission
document.getElementById('registrationForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const form = e.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    try {
        const response = await fetch('/submit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        const messageEl = document.getElementById('message');
        messageEl.textContent = result.message || (result.error || 'Something went wrong');
        messageEl.className = 'message ' + (result.success ? 'success' : 'error');

        if (result.success) {
            form.reset();
        }
    } catch (error) {
        console.error('Error:', error);
        const messageEl = document.getElementById('message');
        messageEl.textContent = 'Failed to submit. Please try again.';
        messageEl.className = 'message error';
    }
});

// Handle login form submission
document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const form = e.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        const messageEl = document.getElementById('loginMessage');
        messageEl.textContent = result.error || 'Login successful';
        messageEl.className = 'message ' + (result.success ? 'success' : 'error');

        if (result.success) {
            setTimeout(() => {
                window.location.href = '/admin';
            }, 1000);
        }
    } catch (error) {
        console.error('Error:', error);
        const messageEl = document.getElementById('loginMessage');
        messageEl.textContent = 'Failed to login. Please try again.';
        messageEl.className = 'message error';
    }
});