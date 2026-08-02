const stroke = 'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';

export const icons = {
  die: `<svg viewBox="0 0 24 24" width="24" height="24"><rect x="3" y="3" width="18" height="18" rx="4" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="8" cy="8" r="1.4" fill="currentColor"/><circle cx="16" cy="8" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="8" cy="16" r="1.4" fill="currentColor"/><circle cx="16" cy="16" r="1.4" fill="currentColor"/></svg>`,

  players: `<svg viewBox="0 0 24 24" width="24" height="24"><circle cx="8.5" cy="9" r="2.8" ${stroke}/><circle cx="16" cy="9.6" r="2.2" ${stroke}/><path d="M3.5 20c0-3.3 2.3-5.5 5-5.5s5 2.2 5 5.5" ${stroke}/><path d="M14 14.8c2.3.5 3.6 2.4 3.6 5.2" ${stroke}/></svg>`,

  clock: `<svg viewBox="0 0 24 24" width="24" height="24"><circle cx="12" cy="12" r="8.2" ${stroke}/><path d="M12 7.6v4.6l3 2" ${stroke}/></svg>`,

  tag: `<svg viewBox="0 0 24 24" width="24" height="24"><path d="M11 3.5H5.5a2 2 0 00-2 2V11l9.5 9.5 7.5-7.5L11 3.5z" ${stroke}/><circle cx="8" cy="8" r="1.3" fill="currentColor"/></svg>`,

  age: `<svg viewBox="0 0 24 24" width="24" height="24"><path d="M12 3.2l7 2.8v5.3c0 5-3.3 8.3-7 9.5-3.7-1.2-7-4.5-7-9.5V6l7-2.8z" ${stroke}/></svg>`,

  trash: `<svg viewBox="0 0 24 24" width="24" height="24"><path d="M4.5 7h15" ${stroke}/><path d="M9.5 7V4.5h5V7" ${stroke}/><path d="M6.5 7l1 12.5h9l1-12.5" ${stroke}/></svg>`,

  edit: `<svg viewBox="0 0 24 24" width="24" height="24"><path d="M4 20l.9-4L16 4.9a1.5 1.5 0 012.1 0l1 1a1.5 1.5 0 010 2.1L8 19l-4 1z" ${stroke}/><path d="M14 6.9L17.1 10" ${stroke}/></svg>`,

  document: `<svg viewBox="0 0 24 24" width="24" height="24"><path d="M7 3.5h7l4 4V20a.6.6 0 01-.6.6H7a.6.6 0 01-.6-.6V4.1a.6.6 0 01.6-.6z" ${stroke}/><path d="M14 3.5V8h4" ${stroke}/><path d="M9 12.5h6M9 16h6" ${stroke}/></svg>`
};
