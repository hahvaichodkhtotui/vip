document.addEventListener('DOMContentLoaded', () => {
    // Tab switching
    const tabs = document.querySelectorAll('.sidebar nav ul li');
    const tabContents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs and contents
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            // Add active class to clicked tab and corresponding content
            tab.classList.add('active');
            const tabId = tab.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');
        });
    });

    // Handle approve/deny buttons
    document.querySelectorAll('.approve-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.target.getAttribute('data-id');
            try {
                const response = await fetch(`/admin/approve/${id}`, {
                    method: 'POST'
                });

                const result = await response.json();
                if (result.success) {
                    window.location.reload();
                }
            } catch (error) {
                console.error('Error:', error);
                alert('Failed to approve. Please try again.');
            }
        });
    });

    document.querySelectorAll('.deny-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.target.getAttribute('data-id');
            try {
                const response = await fetch(`/admin/deny/${id}`, {
                    method: 'POST'
                });

                const result = await response.json();
                if (result.success) {
                    window.location.reload();
                }
            } catch (error) {
                console.error('Error:', error);
                alert('Failed to deny. Please try again.');
            }
        });
    });
});