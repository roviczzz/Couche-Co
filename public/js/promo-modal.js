class PromoModal {
  constructor() {
    this.modalOverlay = null;
    this.modalContainer = null;
    this.closeButton = null;
    this.imageElement = null;
    this.promoData = null;
    this.dismissDuration = 24;
  }

  async init() {
    try {
      this.cacheElements();
      if (!this.modalOverlay) return;

      await this.fetchPromoData();

      if (!this.promoData || !this.promoData.enabled || !this.promoData.imageUrl) {
        return;
      }

      this.dismissDuration = this.promoData.dismissDuration || 24;

      const dismissKey = `promoModalDismissed-${this.getDismissKeyDate()}`;

      if (sessionStorage.getItem(dismissKey)) {
        return;
      }

      this.attachEventListeners();
      this.setImage(this.promoData.imageUrl);
      setTimeout(() => this.show(), 500);
    } catch (error) {
      console.error('Error initializing promo modal:', error);
    }
  }

  cacheElements() {
    this.modalOverlay = document.getElementById('promoModalOverlay');
    this.modalContainer = document.querySelector('.promo-modal-container');
    this.closeButton = document.querySelector('.promo-modal-close');
    this.imageElement = document.querySelector('.promo-modal-image');
  }

  attachEventListeners() {
    if (this.closeButton) {
      this.closeButton.addEventListener('click', (e) => {
        e.stopPropagation();
        this.dismiss();
      });
    }

    if (this.modalOverlay) {
      this.modalOverlay.addEventListener('click', (e) => {
        if (e.target === this.modalOverlay) {
          this.dismiss();
        }
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modalOverlay?.classList.contains('show')) {
        this.dismiss();
      }
    });
  }

  async fetchPromoData() {
    const response = await fetch('/api/promo-modal');
    if (!response.ok) {
      throw new Error(`Failed to fetch promo data: ${response.status}`);
    }
    this.promoData = await response.json();
  }

  getDismissKeyDate() {
    const now = new Date();
    const dismissKey = new Date(now.getTime() + this.dismissDuration * 60 * 60 * 1000);
    return dismissKey.toISOString().split('T')[0];
  }

  setImage(imageUrl) {
    if (this.imageElement) {
      this.imageElement.src = imageUrl;
      this.imageElement.alt = 'Promotional Offer';
    }
  }

  show() {
    if (this.modalOverlay) {
      this.modalOverlay.classList.add('show');
      document.body.style.overflow = 'hidden';
    }
  }

  dismiss() {
    const dismissKey = `promoModalDismissed-${this.getDismissKeyDate()}`;
    sessionStorage.setItem(dismissKey, 'true');

    if (this.modalOverlay) {
      this.modalOverlay.classList.remove('show');
      document.body.style.overflow = '';
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const promoModal = new PromoModal();
  promoModal.init();
});
