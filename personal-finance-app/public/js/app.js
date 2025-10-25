// Add this line at the very top of the file
console.log('App.js has been loaded!');
document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('registerForm');
    const loginForm = document.getElementById('loginForm');
    const transactionForm = document.getElementById('transactionForm');
    const categoryForm = document.getElementById('categoryForm');
    const profileForm = document.getElementById('profileForm');

    const message = document.getElementById('message');
    const transactionList = document.getElementById('transactionList');
    const categoryMessage = document.getElementById('categoryMessage');
    const categoryList = document.getElementById('categoryList');
    const categorySelect = document.getElementById('category');
    const summaryList = document.getElementById('summaryList');
    const chartCanvas = document.getElementById('spendingChart');
    const pieChartCanvas = document.getElementById('spendingPieChart');
    const profileMessage = document.getElementById('profileMessage');
    const welcomeMessage = document.getElementById('welcomeMessage');

    const getAuthToken = () => localStorage.getItem('token');
    
    // Function to delete a transaction
    const deleteTransaction = async (transactionId) => {
        const authToken = getAuthToken();
        if (!authToken) return;

        if (confirm('Are you sure you want to delete this transaction?')) {
            try {
                const response = await fetch(`/transactions/${transactionId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${authToken}`
                    }
                });
                const data = await response.json();
                alert(data.message || data.error);
                if (response.status === 200) {
                    fetchTransactions();
                    fetchSummary();
                }
            } catch (error) {
                console.error('Failed to delete transaction:', error);
                alert('Failed to delete transaction. Please try again.');
            }
        }
    };
    
    // Function to delete a category
    const deleteCategory = async (categoryId) => {
        const authToken = getAuthToken();
        if (!authToken) return;

        if (confirm('Are you sure you want to delete this category? All related transactions will still exist.')) {
            try {
                const response = await fetch(`/categories/${categoryId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${authToken}`
                    }
                });
                const data = await response.json();
                alert(data.message || data.error);
                if (response.status === 200) {
                    fetchCategories(); // Re-fetch categories to update the list
                }
            } catch (error) {
                console.error('Failed to delete category:', error);
                alert('Failed to delete category. Please try again.');
            }
        }
    };

    const fetchCategories = async () => {
        const authToken = getAuthToken();
        if (!authToken) {
            console.log('No token found, unable to fetch categories.');
            return;
        }
        try {
            const response = await fetch('/categories', {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            const categories = await response.json();
            
            categoryList.innerHTML = '';
            categorySelect.innerHTML = '<option value="">--Select a category--</option>';
            
            if (Array.isArray(categories)) {
              categories.forEach(category => {
                const li = document.createElement('li');
                li.innerHTML = `
                  <div class="category-item">
                      <span>${category.name}</span>
                      <button class="delete-btn" data-id="${category.id}">Delete</button>
                  </div>
                `;
                categoryList.appendChild(li);
                
                const option = document.createElement('option');
                option.value = category.name;
                option.textContent = category.name;
                categorySelect.appendChild(option);
              });
            } else {
                console.error('API response is not an array:', categories);
            }
        } catch (error) {
            console.error('Error fetching categories:', error);
        }
    };
    
    const fetchTransactions = async () => {
        const authToken = getAuthToken();
        if (!authToken) return;
        try {
            const response = await fetch('/transactions', {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            const transactions = await response.json();
            
            transactionList.innerHTML = '';
            if (Array.isArray(transactions)) {
              transactions.forEach(transaction => {
                const li = document.createElement('li');
                li.innerHTML = `
                  <div class="transaction-item">
                      <span>₦${transaction.amount} - ${transaction.description} (${transaction.category}) on ${new Date(transaction.transaction_date).toLocaleDateString()}</span>
                      <button class="delete-btn" data-id="${transaction.id}">Delete</button>
                  </div>
                `;
                transactionList.appendChild(li);
              });
            }
        } catch (error) {
            console.error('Error fetching transactions:', error);
        }
    };

    let spendingChart;
    let spendingPieChart;

    const drawBarChart = (data) => {
        if (spendingChart) {
            spendingChart.destroy();
        }
        
        const labels = data.map(item => item.category);
        const amounts = data.map(item => parseFloat(item.total_amount));
        
        const chartData = {
            labels: labels,
            datasets: [{
                label: 'Total Spending by Category',
                data: amounts,
                backgroundColor: 'rgba(54, 162, 235, 0.6)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        };
        
        if (chartCanvas) {
            spendingChart = new Chart(chartCanvas, {
                type: 'bar',
                data: chartData,
                options: {
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
        }
    };
    
    const drawPieChart = (data) => {
        if (spendingPieChart) {
            spendingPieChart.destroy();
        }
        
        const labels = data.map(item => item.category);
        const amounts = data.map(item => parseFloat(item.total_amount));
        
        const chartData = {
            labels: labels,
            datasets: [{
                label: 'Spending Proportion',
                data: amounts,
                backgroundColor: 'rgba(54, 162, 235, 0.8)',
                borderColor: '#ffffff',
                borderWidth: 2
            }]
        };

        if (pieChartCanvas) {
            spendingPieChart = new Chart(pieChartCanvas, {
                type: 'pie',
                data: chartData,
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            position: 'top',
                        },
                        title: {
                            display: true,
                            text: 'Spending Proportions by Category'
                        }
                    }
                }
            });
        }
    };

    const fetchSummary = async () => {
        const authToken = getAuthToken();
        if (!authToken) return;
        try {
            const response = await fetch('/summary', {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            const summaryData = await response.json();
            
            summaryList.innerHTML = '';
            if (Array.isArray(summaryData)) {
              summaryData.forEach(item => {
                const li = document.createElement('li');
                li.textContent = `${item.category}: ₦${parseFloat(item.total_amount).toFixed(2)}`;
                summaryList.appendChild(li);
              });
              if (chartCanvas) {
                drawBarChart(summaryData);
              }
              if (pieChartCanvas) {
                drawPieChart(summaryData);
              }
            }
        } catch (error) {
            console.error('Error fetching summary:', error);
        }
    };
    
    const fetchProfile = async () => {
        const authToken = getAuthToken();
        if (!authToken) return;
        try {
            const response = await fetch('/profile', {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            const userData = await response.json();
            if (response.status === 200) {
                if (document.getElementById('username')) {
                    document.getElementById('username').value = userData.username || '';
                }
                if (document.getElementById('firstName')) {
                    document.getElementById('firstName').value = userData.first_name || '';
                }
                if (document.getElementById('lastName')) {
                    document.getElementById('lastName').value = userData.last_name || '';
                }

                if (welcomeMessage) {
                    welcomeMessage.textContent = `Welcome, ${userData.first_name || userData.username}!`;
                }
            } else if (response.status === 401) {
                window.location.href = '/html/login.html';
            }
        } catch (error) {
            console.error('Error fetching user profile:', error);
        }
    };

    if (profileForm) {
        fetchProfile();

        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(profileForm);
            const profileData = {
                firstName: formData.get('firstName'),
                lastName: formData.get('lastName')
            };
            
            try {
                const response = await fetch('/profile', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${getAuthToken()}`
                    },
                    body: JSON.stringify(profileData)
                });
                
                const data = await response.json();
                profileMessage.textContent = data.message || data.error;
                profileMessage.style.color = response.status === 200 ? 'green' : 'red';
            } catch (error) {
                console.error('Failed to update profile:', error);
                profileMessage.textContent = 'Failed to update profile. Please try again.';
                profileMessage.style.color = 'red';
            }
        });
    }

    if (categoryForm) {
        if (!getAuthToken()) {
            window.location.href = '/html/login.html';
            return;
        }
        categoryForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(categoryForm);
            const categoryName = formData.get('categoryName');
            
            try {
                const response = await fetch('/categories', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${getAuthToken()}`
                    },
                    body: JSON.stringify({ name: categoryName })
                });
                
                const data = await response.json();
                categoryMessage.textContent = data.message || data.error;
                categoryMessage.style.color = response.status === 201 ? 'green' : 'red';

                if (response.status === 201) {
                    categoryForm.reset();
                    fetchCategories();
                    fetchTransactions();
                    fetchSummary();
                }
            } catch (error) {
                console.error('Failed to add category:', error);
                categoryMessage.textContent = 'Failed to add category. Please try again.';
                categoryMessage.style.color = 'red';
            }
        });
    }

    if (transactionForm) {
        transactionForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(transactionForm);
            const transactionData = Object.fromEntries(formData);
            
            try {
                const response = await fetch('/transactions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${getAuthToken()}`
                    },
                    body: JSON.stringify(transactionData)
                });
                
                const data = await response.json();
                message.textContent = data.message || data.error;
                message.style.color = response.status === 201 ? 'green' : 'red';

                if (response.status === 201) {
                    transactionForm.reset();
                    fetchTransactions();
                    fetchSummary();
                }
            } catch (error) {
                console.error('Failed to add transaction:', error);
                message.textContent = 'Failed to add transaction. Please try again.';
                message.style.color = 'red';
            }
        });
    }

    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(registerForm);
            const username = formData.get('username');
            const password = formData.get('password');
            const message = document.getElementById('message');

            try {
                const response = await fetch('/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const data = await response.json();
                message.textContent = data.message || data.error;
                message.style.color = response.status === 201 ? 'green' : 'red';
            } catch (error) {
                console.error('Registration failed:', error);
                message.textContent = 'Registration failed. Please try again.';
                message.style.color = 'red';
            }
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(loginForm);
            const username = formData.get('username');
            const password = formData.get('password');
            const message = document.getElementById('message');

            try {
                const response = await fetch('/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                const data = await response.json();
                if (response.status === 200) {
                    localStorage.setItem('token', data.token);
                    window.location.href = '/html/dashboard.html';
                } else {
                    message.textContent = data.error;
                    message.style.color = 'red';
                }
            } catch (error) {
                console.error('Login failed:', error);
                message.textContent = 'Login failed. Please try again.';
                message.style.color = 'red';
            }
        });
    }

    // Event listener for the delete button
    if (transactionList) {
        transactionList.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete-btn')) {
                const transactionId = e.target.getAttribute('data-id');
                deleteTransaction(transactionId);
            }
        });
    }
    
    // Event listener for the delete button on categories
    if (categoryList) {
        categoryList.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete-btn')) {
                const categoryId = e.target.getAttribute('data-id');
                deleteCategory(categoryId);
            }
        });
    }
    
    // Call all initial data fetching functions if a token exists
    if (getAuthToken()) {
        fetchCategories();
        fetchTransactions();
        fetchSummary();
        fetchProfile();
    } else {
        // Redirect to login if on the dashboard page without a token
        if (window.location.pathname.includes('/html/dashboard.html') || window.location.pathname.includes('/html/profile.html')) {
            window.location.href = '/html/login.html';
        }
    }
});