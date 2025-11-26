(function() {
  const MAX_CHARS = 500;

  function initFeedbackForm() {
    const form = document.getElementById('feedback-form');
    if (!form) return;

    const textarea = form.querySelector('#feedback-comment');
    const charCounter = form.querySelector('.char-count');
    const submitBtn = form.querySelector('.feedback-submit');
    const messageDiv = form.querySelector('.feedback-message');
    const starInputs = form.querySelectorAll('.star-rating input');

    if (textarea && charCounter) {
      textarea.addEventListener('input', function() {
        const remaining = MAX_CHARS - this.value.length;
        charCounter.textContent = remaining;
        
        const counterParent = charCounter.closest('.char-counter');
        if (counterParent) {
          counterParent.classList.toggle('warning', remaining < 50);
        }
        
        if (this.value.length > MAX_CHARS) {
          this.value = this.value.substring(0, MAX_CHARS);
          charCounter.textContent = '0';
        }
      });
    }

    starInputs.forEach(input => {
      input.addEventListener('keydown', function(e) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
          e.preventDefault();
          const nextValue = Math.min(5, parseInt(this.value) + 1);
          const nextInput = form.querySelector(`input[name="rating"][value="${nextValue}"]`);
          if (nextInput) {
            nextInput.checked = true;
            nextInput.focus();
          }
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
          e.preventDefault();
          const prevValue = Math.max(1, parseInt(this.value) - 1);
          const prevInput = form.querySelector(`input[name="rating"][value="${prevValue}"]`);
          if (prevInput) {
            prevInput.checked = true;
            prevInput.focus();
          }
        }
      });
    });

    form.addEventListener('submit', async function(e) {
      e.preventDefault();

      const selectedRating = form.querySelector('input[name="rating"]:checked');
      if (!selectedRating) {
        showMessage(messageDiv, 'Please select a star rating', 'error');
        return;
      }

      const rating = parseInt(selectedRating.value);
      const comment = textarea ? textarea.value.trim() : '';
      const page = form.dataset.page || 'unknown';

      if (rating < 1 || rating > 5) {
        showMessage(messageDiv, 'Invalid rating selected', 'error');
        return;
      }

      setLoading(submitBtn, true);
      hideMessage(messageDiv);

      try {
        const response = await fetch('/api/feedback', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ rating, comment, page })
        });

        const data = await response.json();

        if (data.success) {
          showSubmittedState(form);
        } else {
          showMessage(messageDiv, data.error || 'Failed to submit feedback', 'error');
        }
      } catch (error) {
        showMessage(messageDiv, 'Network error. Please try again.', 'error');
      } finally {
        setLoading(submitBtn, false);
      }
    });
  }

  function setLoading(btn, isLoading) {
    if (!btn) return;
    btn.disabled = isLoading;
    btn.classList.toggle('loading', isLoading);
  }

  function showMessage(div, message, type) {
    if (!div) return;
    div.textContent = message;
    div.className = 'feedback-message ' + type;
  }

  function hideMessage(div) {
    if (!div) return;
    div.className = 'feedback-message';
    div.textContent = '';
  }

  function showSubmittedState(form) {
    const container = form.closest('.feedback-section');
    if (!container) return;

    container.innerHTML = `
      <div class="feedback-submitted">
        <div class="check-icon">✓</div>
        <h4>Thank you for your feedback!</h4>
        <p>Your response has been recorded and helps us improve our service.</p>
      </div>
    `;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFeedbackForm);
  } else {
    initFeedbackForm();
  }
})();
