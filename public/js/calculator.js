document.addEventListener('DOMContentLoaded', () => {
    const calculatorModal = document.getElementById('calculator-modal');
    const calculator = document.getElementById('calculator');
    const calculatorDragHandle = document.getElementById('calculator-drag-handle');
    const calculatorClose = document.getElementById('calculator-close');
    const calculatorExpression = document.getElementById('calculator-expression');
    const calculatorResult = document.getElementById('calculator-result');

    let currentExpression = '';
    let currentResult = '0';
    let lastWasOperator = false;
    let justCalculated = false;

    // Movable calculator logic
    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;
    let startX = 0;
    let startY = 0;
    calculatorDragHandle.addEventListener('mousedown', function(e) {
        isDragging = true;
        const rect = calculator.getBoundingClientRect();
        dragOffsetX = e.clientX - rect.left;
        dragOffsetY = e.clientY - rect.top;
        startX = rect.left;
        startY = rect.top;
        document.body.style.userSelect = 'none';
    });
    document.addEventListener('mousemove', function(e) {
        if (!isDragging) return;
        let x = e.clientX - dragOffsetX;
        let y = e.clientY - dragOffsetY;
        const minX = 8;
        const minY = 8;
        const maxX = window.innerWidth - calculator.offsetWidth - 8;
        const maxY = window.innerHeight - calculator.offsetHeight - 8;
        x = Math.max(minX, Math.min(x, maxX));
        y = Math.max(minY, Math.min(y, maxY));
        calculator.style.left = x + 'px';
        calculator.style.top = y + 'px';
        calculator.style.right = 'auto';
        calculator.style.bottom = 'auto';
        calculator.style.margin = '0';
    });
    document.addEventListener('mouseup', function() {
        isDragging = false;
        document.body.style.userSelect = '';
    });
    function openCalculator() {
        calculatorModal.classList.add('show');
        calculatorModal.setAttribute('aria-hidden', 'false');
        calculator.style.left = 'auto';
        calculator.style.top = 'auto';
        calculator.style.right = '32px';
        calculator.style.bottom = '32px';
        calculator.style.margin = '0';
        document.body.style.overflow = '';
    }

    function closeCalculator() {
        calculatorModal.classList.remove('show');
        calculatorModal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }

    function updateDisplay() {
        calculatorExpression.textContent = currentExpression;
        calculatorResult.textContent = currentResult;
    }

    function clearCalculator() {
        currentExpression = '';
        currentResult = '0';
        lastWasOperator = false;
        justCalculated = false;
        updateDisplay();
    }

    function inputNumber(num) {
        if (justCalculated) {
            currentExpression = '';
            justCalculated = false;
        }

        if (currentResult === '0' && num !== '.') {
            currentResult = num;
        } else {
            currentResult += num;
        }
        lastWasOperator = false;
        updateDisplay();
    }

    function inputOperator(op) {
        if (justCalculated) {
            currentExpression = currentResult;
            justCalculated = false;
        } else if (currentExpression && !lastWasOperator) {
            currentExpression += currentResult;
        } else if (!currentExpression) {
            currentExpression = currentResult;
        }

        if (!lastWasOperator) {
            currentExpression += ' ' + op + ' ';
            currentResult = '0';
            lastWasOperator = true;
            updateDisplay();
        }
    }

    function calculate() {
        if (currentExpression && !lastWasOperator) {
            try {
                const fullExpression = currentExpression + currentResult;
                const cleanExpression = fullExpression.replace(/×/g, '*').replace(/÷/g, '/');
                const result = Function('return ' + cleanExpression)();

                if (isNaN(result) || !isFinite(result)) {
                    currentResult = 'Error';
                } else {
                    currentResult = parseFloat(result.toFixed(10)).toString();
                }

                currentExpression = fullExpression + ' =';
                justCalculated = true;
                lastWasOperator = false;
            } catch (error) {
                currentResult = 'Error';
                currentExpression = '';
            }
            updateDisplay();
        }
    }

    calculatorClose.addEventListener('click', closeCalculator);

    calculatorModal.addEventListener('click', function(e) {
        if (e.target === calculatorModal) {
            closeCalculator();
        }
    });

    document.getElementById('calculator-clear').addEventListener('click', clearCalculator);
    document.getElementById('calculator-equals').addEventListener('click', calculate);

    document.getElementById('calculator-seven').addEventListener('click', () => inputNumber('7'));
    document.getElementById('calculator-eight').addEventListener('click', () => inputNumber('8'));
    document.getElementById('calculator-nine').addEventListener('click', () => inputNumber('9'));
    document.getElementById('calculator-four').addEventListener('click', () => inputNumber('4'));
    document.getElementById('calculator-five').addEventListener('click', () => inputNumber('5'));
    document.getElementById('calculator-six').addEventListener('click', () => inputNumber('6'));
    document.getElementById('calculator-one').addEventListener('click', () => inputNumber('1'));
    document.getElementById('calculator-two').addEventListener('click', () => inputNumber('2'));
    document.getElementById('calculator-three').addEventListener('click', () => inputNumber('3'));
    document.getElementById('calculator-zero').addEventListener('click', () => inputNumber('0'));

    document.getElementById('calculator-add').addEventListener('click', () => inputOperator('+'));
    document.getElementById('calculator-subtract').addEventListener('click', () => inputOperator('-'));
    document.getElementById('calculator-multiply').addEventListener('click', () => inputOperator('×'));
    document.getElementById('calculator-divide').addEventListener('click', () => inputOperator('÷'));
    document.getElementById('calculator-decimal').addEventListener('click', () => {
        if (!currentResult.includes('.')) {
            inputNumber('.');
        }
    });

    document.addEventListener('click', function(e) {
        var calcLink = e.target.closest('a[href="#calculator"]');
        if (calcLink) {
            e.preventDefault();
            if (calculatorModal.classList.contains('show')) {
                closeCalculator();
            } else {
                openCalculator();
            }
        }
    });

    document.addEventListener('keydown', function(e) {
        if (!calculatorModal.classList.contains('show')) return;

        e.preventDefault();

        if (e.key >= '0' && e.key <= '9') {
            inputNumber(e.key);
        } else if (e.key === '+' || e.key === 'Add') {
            inputOperator('+');
        } else if (e.key === '-' || e.key === 'Subtract') {
            inputOperator('-');
        } else if (e.key === '*' || e.key === 'Multiply') {
            inputOperator('×');
        } else if (e.key === '/' || e.key === 'Divide') {
            inputOperator('÷');
        } else if (e.key === '.' || e.key === 'Decimal') {
            if (!currentResult.includes('.')) {
                inputNumber('.');
            }
        } else if (e.key === 'Enter' || e.key === '=') {
            calculate();
        } else if (e.key === 'Escape' || e.key === 'c' || e.key === 'C' || e.key === 'Clear') {
            if (e.key === 'Escape') {
                closeCalculator();
            } else {
                clearCalculator();
            }
        } else if (e.key === 'Backspace') {
            if (currentResult.length > 1) {
                currentResult = currentResult.slice(0, -1);
            } else {
                currentResult = '0';
            }
            updateDisplay();
        }
    });

    updateDisplay();
});
