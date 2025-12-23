import { domRefs } from './dom.js';
import { toggleSponsorModal } from './ui.js';

let sponsorHoverTimeout = null;

export function initSponsorInteractions() {
  const { sponsorBtn, sponsorModal, sponsorModalClose } = domRefs;

  if (sponsorBtn) {
    sponsorBtn.addEventListener('click', () => toggleSponsorModal(true));
    //sponsorBtn.addEventListener('mouseenter', handleSponsorHoverEnter);
    //sponsorBtn.addEventListener('mouseleave', handleSponsorHoverLeave);
  }

  if (sponsorModal) {
    sponsorModal.addEventListener('click', event => {
      if (event.target === sponsorModal) {
        toggleSponsorModal(false);
      }
    });
    sponsorModal.addEventListener('mouseenter', clearSponsorHoverTimeout);
    sponsorModal.addEventListener('mouseleave', handleSponsorHoverLeave);
  }

  if (sponsorModalClose) {
    sponsorModalClose.addEventListener('click', () => toggleSponsorModal(false));
  }

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && sponsorModal?.classList.contains('is-visible')) {
      toggleSponsorModal(false);
    }
  });
}

function handleSponsorHoverEnter() {
  clearSponsorHoverTimeout();
  toggleSponsorModal(true);
}

function handleSponsorHoverLeave() {
  clearSponsorHoverTimeout();
  sponsorHoverTimeout = setTimeout(() => {
    toggleSponsorModal(false);
  }, 200);
}

function clearSponsorHoverTimeout() {
  if (sponsorHoverTimeout) {
    clearTimeout(sponsorHoverTimeout);
    sponsorHoverTimeout = null;
  }
}

