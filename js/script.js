class SalesDashboard {
    constructor() {
        this.orders = [];
        this.currentView = 'dashboard';
        this.filteredOrders = [];
        this.charts = {
            country: null,
            products: null,
            salesTrend: null
        };
        this.initialize();

        this.todayOrders = []; // Initialize the array
    }

    async initialize() {
        await this.loadData();
        this.setupEventListeners();
        this.initFilters();
        this.initCharts();

        // Set the period filter to "Este Mes" by default
        document.getElementById('filter-period').value = 'month';

        this.applyFilters();
        this.setupView();
    }

    getMonthName(monthIndex) {
        const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                       'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        return months[monthIndex];
    }

    getCurrencySymbol(country) {
        const europeanCountries = ['Spain', 'France', 'Germany', 'Italy', 'Portugal', 'Netherlands', 'Belgium', 
            'Austria', 'Switzerland', 'Andorra', 'Luxembourg', 'Monaco', 'Ireland', 'Finland', 
            'Sweden', 'Denmark', 'Norway', 'Poland', 'Greece', 'Hungary', 'Romania', 
            'Bulgaria', 'Croatia', 'Slovakia', 'Slovenia', 'Czech Republic', 'Estonia', 
            'Latvia', 'Lithuania', 'Cyprus', 'Malta'];
        
        // Normalize the country name for comparison
        if (!country) return '$'; // Default to USD
        const normalizedCountry = country.toLowerCase().trim();
        const isEuropean = europeanCountries.some(c => c.toLowerCase() === normalizedCountry);
        
        return isEuropean ? '€' : '$';
    }

    getMonthlyComparison(data) {
        const monthlyData = {};
        const currentYear = new Date().getFullYear();
        
        // Initialize all months of the current year
        for (let month = 0; month < 12; month++) {
            const key = `${currentYear}-${month}`;
            monthlyData[key] = {
                month: this.getMonthName(month),
                orders: 0,
                sales: 0,
                products: 0,
                hasData: false
            };
        }
        
        // Process actual data
        data.forEach(order => {
            const orderDate = order.date;
            const year = orderDate.getFullYear();
            const month = orderDate.getMonth();
            
            if (year === currentYear) {
                const key = `${year}-${month}`;
                monthlyData[key].orders++;
                // Ensure precio_compra_total is parsed as float
                monthlyData[key].sales += parseFloat(order.precio_compra_total) || 0; 
                monthlyData[key].products += order.compras.reduce((acc, curr) => acc + (curr.quantity || 0), 0);
                monthlyData[key].hasData = true;
            }
        });
        
        return Object.values(monthlyData).sort((a, b) => {
            const monthA = this.getMonthIndex(a.month);
            const monthB = this.getMonthIndex(b.month);
            return monthA - monthB;
        });
    }
    
    getMonthIndex(monthName) {
        const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                       'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        return months.indexOf(monthName);
    }
    
    renderMonthlyComparison(data) {
        const container = document.getElementById('general-summary');
        if (!container) return;
    
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const period = document.getElementById('filter-period')?.value || 'month';
    
        // Get all monthly data from original orders for yearly comparison
        const monthlyData = this.getMonthlyComparison(this.orders); 
        
        // Data for the current selected period
        let currentPeriodData;
        if (period === 'all' || period === 'year') {
            currentPeriodData = {
                sales: data.reduce((sum, order) => sum + (parseFloat(order.precio_compra_total) || 0), 0),
                orders: data.length,
                products: data.reduce((sum, order) => sum + order.compras.reduce((acc, item) => acc + (item.quantity || 0), 0), 0)
            };
        } else {
            const targetMonth = period === 'month' ? currentMonth : (currentMonth - 1 + 12) % 12;
            currentPeriodData = monthlyData.find(m => this.getMonthIndex(m.month) === targetMonth) || { month: this.getMonthName(targetMonth), orders: 0, sales: 0, products: 0 };
        }
        
        // Data for the previous month with data (for comparison)
        let lastMonthWithData = null;
        if (period !== 'all' && period !== 'year') {
            const referenceMonth = period === 'month' ? currentMonth : (currentMonth - 1 + 12) % 12;
            for (let i = 1; i < 12; i++) { // Look up to 11 months back
                const checkMonth = (referenceMonth - i + 12) % 12;
                const monthData = monthlyData.find(m => 
                    this.getMonthIndex(m.month) === checkMonth && 
                    (m.orders > 0 || m.sales > 0)
                );
                
                if (monthData) {
                    lastMonthWithData = monthData;
                    break;
                }
            }
        }
    
        // Calculate percentage changes only if there is data from the previous month
        let salesChangeHtml = '';
        let ordersChangeHtml = '';
        
        if (lastMonthWithData && currentPeriodData && period !== 'all' && period !== 'year') {
            const salesChange = lastMonthWithData.sales > 0 ? 
                ((currentPeriodData.sales - lastMonthWithData.sales) / lastMonthWithData.sales * 100).toFixed(1) : 0;
            const ordersChange = lastMonthWithData.orders > 0 ? 
                ((currentPeriodData.orders - lastMonthWithData.orders) / lastMonthWithData.orders * 100).toFixed(1) : 0;
            
            salesChangeHtml = `
                <div class="stat-change ${salesChange >= 0 ? 'positive' : 'negative'}">
                    ${salesChange >= 0 ? '↑' : '↓'} ${Math.abs(salesChange)}% 
                    vs ${lastMonthWithData.month}
                </div>
            `;
            
            ordersChangeHtml = `
                <div class="stat-change ${ordersChange >= 0 ? 'positive' : 'negative'}">
                    ${ordersChange >= 0 ? '↑' : '↓'} ${Math.abs(ordersChange)}%
                </div>
            `;
        } else if (period === 'year' || period === 'all') {
            // For yearly/all period, we don't compare to a previous month directly in this summary card.
            // We can show "N/A" or omit.
            salesChangeHtml = `<div class="stat-change na">N/A</div>`;
            ordersChangeHtml = `<div class="stat-change na">N/A</div>`;
        }
    
        // Yearly data (always show the complete annual total from all orders)
        const totalYearlySales = monthlyData.reduce((sum, month) => sum + month.sales, 0);
        const totalYearlyOrders = monthlyData.reduce((sum, month) => sum + month.orders, 0);
        const totalYearlyProducts = monthlyData.reduce((sum, month) => sum + month.products, 0);
    
        // Determine the title based on the period
        let title = `Resumen ${currentYear}`;
        if (period === 'month') title = `Resumen ${this.getMonthName(currentMonth)}`;
        if (period === 'last-month') title = `Resumen ${this.getMonthName((currentMonth - 1 + 12) % 12)}`;
        if (period === 'all') title = `Resumen Histórico`;
    
        container.innerHTML = `
            <div class="summary-card">
                <div class="summary-header">
                    <h3><i class="fas fa-chart-line"></i> ${title}</h3>
                    <span class="period-badge">
                        ${period === 'month' ? this.getMonthName(currentMonth) : 
                           period === 'last-month' ? this.getMonthName((currentMonth - 1 + 12) % 12) : 
                           (period === 'year' ? 'Anual' : 'Todo el tiempo')}
                    </span>
                </div>
                
                <div class="summary-grid">
                    <div class="summary-item highlight">
                        <div class="stat-value">$${currentPeriodData.sales.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                        <div class="stat-label">${period === 'month' || period === 'last-month' ? 'Ventas del mes' : 'Ventas del periodo'}</div>
                        ${salesChangeHtml}
                    </div>
                    
                    <div class="summary-item">
                        <div class="stat-value">${currentPeriodData.orders.toLocaleString()}</div>
                        <div class="stat-label">${period === 'month' || period === 'last-month' ? 'Pedidos' : 'Pedidos del periodo'}</div>
                        ${ordersChangeHtml}
                    </div>
                    
                    <div class="summary-item">
                        <div class="stat-value">${currentPeriodData.products.toLocaleString()}</div>
                        <div class="stat-label">Productos Vendidos</div>
                    </div>
                    
                    <div class="summary-item yearly">
                        <div class="stat-value">$${totalYearlySales.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                        <div class="stat-label">Ventas anuales totales</div>
                        <div class="stat-sub">${totalYearlyOrders.toLocaleString()} pedidos, ${totalYearlyProducts.toLocaleString()} productos</div>
                    </div>
                </div>
            </div>
        `;
    }

    async loadData() {
        try {
            const response = await fetch('data/estadistica.json'); 
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            this.orders = await response.json();
            
            if (!Array.isArray(this.orders)) {
                throw new Error('Invalid data: not an array');
            }
            
            this.normalizeData();
            this.filteredOrders = [...this.orders];
        } catch (error) {
            console.error('Error loading data:', error);
            this.showAlert('Error al cargar los datos. Intente recargar la página.', 'error');
            
            if (localStorage.getItem('cached_orders')) {
                this.orders = JSON.parse(localStorage.getItem('cached_orders'));
                this.normalizeData();
                this.filteredOrders = [...this.orders];
                this.showAlert('Usando datos almacenados localmente', 'warning');
            }
        }
    }

    normalizeData() {
        this.orders.forEach(order => {
            order.date = new Date(order.fecha_hora_entrada.replace(/\(.*?\)/, ''));
            order.dateStr = order.date.toLocaleDateString('es-ES', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            // Ensure precio_compra_total is parsed as float, it might be a string in JSON
            order.total = parseFloat(order.precio_compra_total) || 0;
            order.productsCount = order.compras.reduce((acc, curr) => acc + (curr.quantity || 0), 0);
            order.userType = order.tipo_usuario || 'No especificado';
            order.country = order.pais || 'No especificado';
            order.searchText = `${order.nombre_comprador} ${order.country} ${order.userType} ${order.telefono_comprador} ${order.correo_comprador}`.toLowerCase();
            
            const today = new Date();
            if (order.date.getDate() === today.getDate() && 
                order.date.getMonth() === today.getMonth() && 
                order.date.getFullYear() === today.getFullYear()) {
                this.todayOrders.push(order);
            }
        });
    }

    exportData() {
        try {
            const wb = XLSX.utils.book_new();
            
            const summaryData = [
                ["Métrica", "Valor"],
                ["Total de pedidos", this.filteredOrders.length],
                ["Ventas totales", `$${this.filteredOrders.reduce((acc, order) => acc + order.total, 0).toFixed(2)}`],
                ["Productos vendidos", this.filteredOrders.reduce((acc, order) => acc + order.productsCount, 0)],
                ["Clientes únicos", new Set(this.filteredOrders.map(order => order.correo_comprador)).size],
                ["Países únicos", new Set(this.filteredOrders.map(order => order.pais)).size]
            ];
            
            const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
            XLSX.utils.book_append_sheet(wb, wsSummary, "Resumen");
            
            const ordersData = this.filteredOrders.map(order => ({
                "Fecha": order.date.toLocaleString(),
                "Cliente": order.nombre_comprador,
                "Email": order.correo_comprador,
                "Teléfono": order.telefono_comprador,
                "País": order.pais,
                "Total": order.total,
                "Productos Cant.": order.productsCount,
                "Navegador": order.navegador,
                "Sistema Operativo": order.sistema_operativo,
                "Origen URL": order.origen,
                "Fuente Tráfico": order.fuente_trafico
            }));
            
            const wsOrders = XLSX.utils.json_to_sheet(ordersData);
            XLSX.utils.book_append_sheet(wb, wsOrders, "Pedidos");
            
            const productsData = Object.entries(
                this.filteredOrders.reduce((acc, order) => {
                    order.compras.forEach(product => {
                        const key = product.name; // Use 'name' from new JSON
                        acc[key] = acc[key] || { producto: key, cantidad: 0, total: 0 };
                        acc[key].cantidad += product.quantity;
                        // Calculate total considering unitPrice and discount
                        const itemTotal = (product.unitPrice * product.quantity) * (1 - (product.discount || 0) / 100);
                        acc[key].total += itemTotal;
                    });
                    return acc;
                }, {})
            ).map(([_, product]) => product);
            
            const wsProducts = XLSX.utils.json_to_sheet(productsData);
            XLSX.utils.book_append_sheet(wb, wsProducts, "Productos");
            
            const dateStr = new Date().toISOString().slice(0, 10);
            XLSX.writeFile(wb, `Estadisticas_Analytics_${dateStr}.xlsx`);
            
        } catch (error) {
            console.error("Error al exportar:", error);
            this.showAlert("Ocurrió un error al generar el archivo de exportación", 'error');
        }
    }

    initCharts() {
        // Define colors from the new palette
        const darkTealBlue = '#245668';
        const tealGreen = '#0D8F81';
        const lightGreen = '#6EC574';
        const yellowAccent = '#EDEF5D';
        const errorColor = '#FF6384'; // A specific red for error/negative, since new palette doesn't have one

        const gridColor = 'rgba(255, 255, 255, 0.15)'; 
        const textColor = '#FFFFFF'; 
        const tooltipBg = 'rgba(36, 86, 104, 0.95)'; // Dark Teal Blue with high transparency for tooltip
        
        // Country chart (doughnut)
        const countryCtx = document.getElementById('country-chart')?.getContext('2d');
        if (countryCtx) {
            this.charts.country = new Chart(countryCtx, {
                type: 'doughnut',
                data: { labels: [], datasets: [{
                    data: [],
                    backgroundColor: [
                        yellowAccent, lightGreen, tealGreen, darkTealBlue, errorColor, // Using main palette colors
                        '#8A2BE2', '#DC143C', '#20B2AA', '#FF4500', '#DAA520' // Additional distinct colors if more are needed
                    ], 
                    borderWidth: 0,
                    hoverBorderWidth: 3, // Slightly thicker hover border
                    hoverBorderColor: 'rgba(255, 255, 255, 0.9)'
                }]},
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '70%', // Slightly larger cutout for modern look
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: {
                                color: textColor,
                                font: { size: 13 }, // Slightly larger font
                                padding: 25, // More padding
                                usePointStyle: true,
                                pointStyle: 'circle'
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: (context) => {
                                    const label = context.label || '';
                                    const value = context.raw || 0;
                                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                    const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                                    return `${label}: $${value.toFixed(2)} (${percentage}%)`;
                                }
                            },
                            backgroundColor: tooltipBg,
                            titleColor: 'white', 
                            bodyColor: 'white', 
                            borderColor: darkTealBlue, // Border matches primary background
                            borderWidth: 1.5, // Slightly thicker border
                            cornerRadius: 8 // Rounded corners for tooltips
                        }
                    },
                    animation: {
                        animateScale: true,
                        animateRotate: true
                    }
                }
            });
        }

        // Product chart (bar)
        const productsCtx = document.getElementById('products-chart')?.getContext('2d');
        if (productsCtx) {
            this.charts.products = new Chart(productsCtx, {
                type: 'bar',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Unidades Vendidas',
                        data: [],
                        backgroundColor: tealGreen, // Teal Green
                        borderRadius: 8, // More rounded bars
                        borderWidth: 0,
                        hoverBackgroundColor: lightGreen // Light Green on hover
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: (context) => `${context.raw} unidades vendidas`
                            },
                            backgroundColor: tooltipBg,
                            titleColor: 'white',
                            bodyColor: 'white',
                            borderColor: darkTealBlue,
                            borderWidth: 1.5,
                            cornerRadius: 8
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: { color: gridColor },
                            ticks: { color: textColor, font: { size: 12 } }
                        },
                        x: {
                            grid: { display: false },
                            ticks: { color: textColor, font: { size: 12 } }
                        }
                    }
                }
            });
        }

        // Sales trend chart (line)
        const trendCtx = document.getElementById('sales-trend-chart')?.getContext('2d');
        if (trendCtx) {
            this.charts.salesTrend = new Chart(trendCtx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Ventas ($)',
                        data: [],
                        borderColor: yellowAccent, // Yellow Accent
                        backgroundColor: 'rgba(237, 239, 93, 0.15)', // Yellow Accent with transparency
                        borderWidth: 4, // Thicker line
                        fill: true,
                        tension: 0.4, // Smoother curve
                        pointBackgroundColor: yellowAccent,
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointRadius: 6, // Slightly smaller points
                        pointHoverRadius: 8
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: (context) => `$${context.raw.toFixed(2)}`
                            },
                            backgroundColor: tooltipBg,
                            titleColor: 'white',
                            bodyColor: 'white',
                            borderColor: darkTealBlue,
                            borderWidth: 1.5,
                            cornerRadius: 8
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: { color: gridColor },
                            ticks: { 
                                color: textColor,
                                callback: (value) => `$${value}`,
                                font: { size: 12 }
                            }
                        },
                        x: {
                            grid: { color: gridColor },
                            ticks: { color: textColor, font: { size: 12 } }
                        }
                    }
                }
            });
        }
    }

    updateCharts(data) {
        // Country chart
        if (this.charts.country) {
            const countries = this.getCountryDistribution(data);
            this.charts.country.data.labels = countries.map(c => c.country || 'Sin país');
            this.charts.country.data.datasets[0].data = countries.map(c => c.total || 0);
            
            this.charts.country.options.plugins.tooltip.callbacks.label = (context) => {
                const value = context.raw || 0;
                return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            };
            this.charts.country.update();
        }

        // Products chart
        if (this.charts.products) {
            const products = this.getTopProducts(data, 5);
            this.charts.products.data.labels = products.map(p => p.product || 'Sin nombre');
            this.charts.products.data.datasets[0].data = products.map(p => p.quantity || 0);
            
            this.charts.products.options.plugins.tooltip.callbacks.label = (context) => {
                const value = context.raw || 0;
                return `${value} unidades`;
            };
            this.charts.products.update();
        }

        // Update trend chart
        if (this.charts.salesTrend) {
            const trendData = this.getSalesTrend(data);
            this.charts.salesTrend.data.labels = trendData.map(d => d.date);
            this.charts.salesTrend.data.datasets[0].data = trendData.map(d => d.total);
            
            // Update tooltip with new data
            this.charts.salesTrend.options.plugins.tooltip.callbacks.afterBody = (context) => {
                const date = context[0].label;
                const dailyOrders = data.filter(o => {
                    const orderDate = o.date.toISOString().split('T')[0];
                    return orderDate === date;
                }).length;
                return [`Pedidos: ${dailyOrders}`];
            };
            
            this.charts.salesTrend.update();
        }
    }

    getCountryDistribution(data) {
        const countries = data.reduce((acc, order) => {
            // Use 'pais' from the new JSON format
            acc[order.pais] = (acc[order.pais] || 0) + (parseFloat(order.precio_compra_total) || 0);
            return acc;
        }, {});

        return Object.entries(countries)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([country, total]) => ({ country, total }));
    }

    getTopProducts(data, limit = 10) {
        const products = data.reduce((acc, order) => {
            // Iterate over 'compras' array, which contains product objects
            order.compras.forEach(product => {
                // Use 'name' from the new product object structure
                acc[product.name] = (acc[product.name] || 0) + (product.quantity || 0);
            });
            return acc;
        }, {});

        return Object.entries(products)
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([product, quantity]) => ({ product, quantity }));
    }

    getSalesTrend(data) {
        const dailySales = data.reduce((acc, order) => {
            const dateStr = order.date.toISOString().split('T')[0];
            // Use 'precio_compra_total' for sales total
            acc[dateStr] = (acc[dateStr] || 0) + (parseFloat(order.precio_compra_total) || 0);
            return acc;
        }, {});

        return Object.entries(dailySales)
            .map(([date, total]) => ({ date, total }))
            .sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    setupEventListeners() {
        // Export data
        document.querySelector('.btn-primary-modern.btn-export')?.addEventListener('click', () => {
            this.exportData();
        });

        // Menu toggle
        document.addEventListener('click', (e) => {
            if (e.target.closest('.menu-toggle')) {
                document.querySelector('.sidebar').classList.add('active');
                document.body.classList.add('menu-open');
            }
            
            if (e.target.closest('.close-menu')) {
                document.querySelector('.sidebar').classList.remove('active');
                document.body.classList.remove('menu-open');
            }
        });

        // Filters
        document.querySelectorAll('.filter-group select, .filter-group input').forEach(el => 
            el.addEventListener('change', () => this.applyFilters()));

        // Toggle order details
        document.addEventListener('click', (e) => {
            if (e.target.closest('.order-header')) {
                const details = e.target.closest('.order-card').querySelector('.order-details');
                details.classList.toggle('active');
            }
        });

        // Refresh orders list
        document.getElementById('refresh-data')?.addEventListener('click', async () => {
            const refreshBtn = document.getElementById('refresh-data');
            const originalText = refreshBtn.innerHTML;
            
            refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Actualizando...';
            refreshBtn.disabled = true;
            
            try {
                await this.loadData();
                this.applyFilters();
                this.showAlert('✅ Datos actualizados correctamente', 'success');
            } catch (error) {
                console.error('Error al actualizar datos:', error);
                this.showAlert(`❌ Error al actualizar: ${error.message}`, 'error');
            } finally {
                setTimeout(() => {
                    refreshBtn.innerHTML = originalText;
                    refreshBtn.disabled = false;
                }, 1000);
            }
        });

        // View change
        document.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', () => {
                this.currentView = item.dataset.view;
                this.setupView();
            });
        });

        // Search in orders
        const searchOrdersInput = document.getElementById('search-orders');
        if (searchOrdersInput) {
            searchOrdersInput.addEventListener('input', (e) => {
                const searchTerm = e.target.value.toLowerCase();
                this.filteredOrders = this.orders.filter(order => 
                    order.searchText.includes(searchTerm)
                );
                this.renderOrders(this.filteredOrders);
            });
        }
    }

    showAlert(message, type = 'success') {
        const alert = document.createElement('div');
        alert.className = `alert ${type}`;
        alert.innerHTML = `
            ${type === 'loading' ? 
                '<i class="fas fa-spinner fa-spin"></i>' : 
                type === 'success' ? 
                '<i class="fas fa-check-circle"></i>' : 
                '<i class="fas fa-exclamation-circle"></i>'}
            <span>${message}</span>
            ${type !== 'loading' ? '<button class="close-alert"><i class="fas fa-times"></i></button>' : ''}
        `;
        
        document.body.appendChild(alert);
        
        if (type !== 'loading') {
            setTimeout(() => {
                alert.classList.add('show');
            }, 10);
            
            setTimeout(() => {
                alert.classList.remove('show');
                setTimeout(() => alert.remove(), 300);
            }, 7000);
        } else {
            alert.classList.add('show');
        }
        
        alert.querySelector('.close-alert')?.addEventListener('click', () => {
            alert.classList.remove('show');
            setTimeout(() => alert.remove(), 300);
        });
        
        return alert;
    }

    setupView() {
        document.querySelectorAll('.menu-item').forEach(item => {
            item.classList.toggle('active', item.dataset.view === this.currentView);
        });
    
        document.querySelectorAll('.view-content').forEach(view => {
            view.classList.toggle('hidden', view.id !== `${this.currentView}-view`);
        });
    
        const filters = document.querySelector('.filters');
        if (filters) {
            filters.style.display = this.currentView === 'dashboard' ? 'flex' : 'none';
        }
    }
    
    initFilters() {
        const populateSelect = (selector, key) => {
            const select = document.querySelector(selector);
            const values = [...new Set(this.orders.map(item => item[key]))].filter(Boolean);
            select.innerHTML = '<option value="">Todos</option>' + 
                values.map(value => `<option value="${value}">${value}</option>`).join('');
        };

        populateSelect('#filter-country', 'pais'); // Use 'pais' from new JSON
    }

    applyFilters() {
        if (this.currentView !== 'dashboard') return;
    
        const startDate = document.getElementById('filter-date-start')?.value;
        const endDate = document.getElementById('filter-date-end')?.value;
        const country = document.getElementById('filter-country')?.value;
        const period = document.getElementById('filter-period')?.value || 'month';
    
        const now = new Date();
        let periodStart, periodEnd;
        
        switch (period) {
            case 'month':
                periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
                periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                periodEnd.setHours(23, 59, 59, 999); // Set to end of the day
                break;
            case 'last-month':
                periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                periodEnd = new Date(now.getFullYear(), now.getMonth(), 0);
                periodEnd.setHours(23, 59, 59, 999); // Set to end of the day
                break;
            case 'year':
                periodStart = new Date(now.getFullYear(), 0, 1);
                periodEnd = new Date(now.getFullYear(), 11, 31);
                periodEnd.setHours(23, 59, 59, 999); // Set to end of the day
                break;
            default: // 'all'
                periodStart = null;
                periodEnd = null;
        }
    
        this.filteredOrders = this.orders.filter(order => {
            const orderDate = order.date;
            const orderDateOnly = new Date(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate()); // Date without time for range comparison
            
            const dateInRange = 
                (!startDate || orderDateOnly >= new Date(startDate)) && 
                (!endDate || orderDateOnly <= new Date(endDate));
                
            const periodInRange = 
                !periodStart || 
                (orderDate >= periodStart && orderDate <= periodEnd);
                
            return (
                dateInRange &&
                periodInRange &&
                (!country || order.pais === country) // Use 'pais' from new JSON
            );
        });
    
        this.updateStats(this.filteredOrders);
        this.renderMonthlyComparison(this.filteredOrders);
        this.renderWeeklySummary();
        this.renderOrders(this.filteredOrders);
        this.updateCharts(this.filteredOrders);
    }
    
    renderWeeklySummary() {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // Today's date without hours/minutes
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1); // Yesterday's date
    
        const todayOrders = this.orders.filter(order => {
            const orderDate = new Date(order.date.getFullYear(), order.date.getMonth(), order.date.getDate());
            return orderDate.getTime() === today.getTime();
        });
    
        const yesterdayOrders = this.orders.filter(order => {
            const orderDate = new Date(order.date.getFullYear(), order.date.getMonth(), order.date.getDate());
            return orderDate.getTime() === yesterday.getTime();
        });
    
        const todaySales = todayOrders.reduce((sum, order) => sum + (parseFloat(order.precio_compra_total) || 0), 0);
        const yesterdaySales = yesterdayOrders.reduce((sum, order) => sum + (parseFloat(order.precio_compra_total) || 0), 0);
    
        let salesChange = "N/A";
        if (yesterdaySales > 0) {
            salesChange = ((todaySales - yesterdaySales) / yesterdaySales * 100).toFixed(1);
        }
    
        const container = document.getElementById('weekly-summary');
        container.innerHTML = `
            <div class="summary-item">
                <h4><i class="fas fa-sun"></i> Hoy</h4>
                <div class="stat-value">$${todaySales.toFixed(2)}</div>
                <div class="stat-label">${todayOrders.length} pedidos</div>
            </div>
            <div class="summary-item">
                <h4><i class="fas fa-moon"></i> Ayer</h4>
                <div class="stat-value">$${yesterdaySales.toFixed(2)}</div>
                <div class="stat-change ${salesChange !== "N/A" && salesChange >= 0 ? 'positive' : 'negative'}">
                    ${salesChange !== "N/A" ? `${salesChange >= 0 ? '↑' : '↓'} ${Math.abs(salesChange)}%` : 'Sin datos previos'}
                </div>
            </div>
        `;
    }

    updateStats(data) {
        if (!data || !Array.isArray(data)) return;
        
        let totalSalesUSD = 0;
        let totalSalesEUR = 0;
        
        data.forEach(order => {
            const country = order.pais || ''; // Use 'pais' from new JSON
            const orderTotal = parseFloat(order.precio_compra_total) || 0;
            if (this.getCurrencySymbol(country) === '€') {
                totalSalesEUR += orderTotal;
            } else {
                totalSalesUSD += orderTotal;
            }
        });
        
        document.getElementById('total-sales-usd').textContent = 
            `$${totalSalesUSD.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        
        document.getElementById('total-sales-eur').textContent = 
            `€${totalSalesEUR.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        
        const totalProductsSold = data.reduce((acc, order) => acc + (order.compras.reduce((sum, item) => sum + (item.quantity || 0), 0)), 0);
        const uniqueCustomers = new Set(data.map(order => order.correo_comprador).filter(Boolean)).size;
        
        document.getElementById('total-products').textContent = totalProductsSold.toLocaleString();
        document.getElementById('total-orders').textContent = data.length.toLocaleString();
        document.getElementById('unique-customers').textContent = uniqueCustomers.toLocaleString();
    
        const totalCombined = totalSalesUSD + totalSalesEUR;
        document.getElementById('total-sales').textContent = 
        `$${totalCombined.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    }

    renderOrders(data) {
        const container = document.getElementById('orders-list');
        const noSalesMessage = document.getElementById('no-sales-message');
        if (!container || !noSalesMessage) return;

        if (data.length === 0) {
            container.innerHTML = '';
            noSalesMessage.classList.remove('hidden');
            return;
        } else {
            noSalesMessage.classList.add('hidden');
        }

        container.innerHTML = data
            .sort((a, b) => b.date - a.date)
            .map(order => `
                <div class="order-card">
                    <div class="order-header">
                        <div class="order-main-info">
                            <h4>${order.nombre_comprador}</h4>
                            <div class="order-meta">
                                <span class="meta-item">
                                    <i class="fas fa-calendar"></i>
                                    ${order.dateStr}
                                </span>
                                <span class="meta-item">
                                    <i class="fas fa-globe"></i>
                                    ${order.pais}
                                </span>
                                <span class="meta-item">
                                    <i class="fas fa-user-tag"></i>
                                    ${order.tipo_usuario}
                                </span>
                                ${order.afiliado && order.afiliado !== 'Ninguno' ? `
                                <span class="meta-item">
                                    <i class="fas fa-handshake"></i>
                                    Afiliado: ${order.afiliado}
                                </span>
                                ` : ''}
                            </div>
                        </div>
                        <div class="order-stats">
                            <div class="stat-value">$${(parseFloat(order.precio_compra_total) || 0).toFixed(2)}</div>
                            <div class="stat-label">${order.compras.reduce((acc, item) => acc + (item.quantity || 0), 0)} productos</div>
                        </div>
                    </div>
                    <div class="order-details">
                        <div class="products-list">
                            ${order.compras.map(product => `
                                <div class="product-item">
                                    <span>${product.name}</span>
                                    <span>${product.quantity} × $${(product.unitPrice || 0).toFixed(2)}</span>
                                    ${(product.discount || 0) > 0 ? `<span style="color: var(--error-color); font-size: 0.8em;"> (${product.discount}% desc.)</span>` : ''}
                                </div>
                            `).join('')}
                        </div>
                        <div class="order-footer">
                            <div class="meta-item">
                                <i class="fas fa-desktop"></i>
                                ${order.navegador} / ${order.sistema_operativo}
                            </div>
                            <div class="meta-item">
                                <i class="fas fa-phone"></i>
                                ${order.telefono_comprador}
                            </div>
                            <div class="meta-item">
                                <i class="fas fa-envelope"></i>
                                ${order.correo_comprador}
                            </div>
                            <div class="meta-item">
                                <i class="fas fa-link"></i>
                                Origen: <a href="${order.origen}" target="_blank" style="color: inherit; text-decoration: underline;">${new URL(order.origen).hostname}</a>
                            </div>
                            ${order.fuente_trafico ? `
                            <div class="meta-item">
                                <i class="fas fa-globe"></i>
                                Fuente Tráfico: <a href="${order.fuente_trafico}" target="_blank" style="color: inherit; text-decoration: underline;">${new URL(order.fuente_trafico).hostname}</a>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `).join('');
    }
}

document.addEventListener('DOMContentLoaded', () => new SalesDashboard());
