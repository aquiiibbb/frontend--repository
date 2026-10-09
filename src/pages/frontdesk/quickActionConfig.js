// Config-driven definition of the reservation "⋮" mega menu (5 columns) and
// the small popup form each menu item opens. Keeping this data-driven means
// ReservationActionMenu.jsx and QuickActionModal.jsx stay generic — add a
// new action here and it shows up in the menu + gets a working form for free.
// Every action's data is saved through the real Booking API (see
// Calendar.jsx -> handleQuickAction), so it always reflects on the Calendar
// grid and on the Master Data report, which both read from the same records.

export const MENU_GROUPS = [
  {
    title: "RESERVATION",
    accent: "#C0453D",
    items: [
      { id: "editReservation", label: "Edit Reservation", icon: "🗓️" },
      { id: "modifyCheckIn", label: "Modify Check In", icon: "🕐" },
      { id: "modifyCheckout", label: "Modify Checkout", icon: "🕐" },
      { id: "moveRoom", label: "Move Room", icon: "🔁" },
      { id: "undo", label: "Undo", icon: "↩️" },
      { id: "delete", label: "Delete", icon: "🗑️" },
      { id: "noShow", label: "No Show", icon: "🚫" },
      { id: "enquiry", label: "Enquiry", icon: "❓" },
      { id: "block", label: "Block", icon: "🔒" },
      { id: "unblock", label: "Unblock", icon: "🔓" },
    ],
  },
  {
    title: "GUEST",
    accent: "#3D8A6B",
    items: [
      { id: "sendSelfCheckIn", label: "Send Self Check-In Link", icon: "📱" },
      { id: "addGuest", label: "Add Guest", icon: "👤" },
      { id: "editGuest", label: "Edit Guest", icon: "👤" },
      { id: "guestDetails", label: "Guest Details", icon: "🪪" },
      { id: "scanId", label: "Scan ID", icon: "🪪" },
      { id: "scanSignature", label: "Scan Signature", icon: "✍️" },
      { id: "addNotes", label: "Add Notes", icon: "📝" },
    ],
  },
  {
    title: "FINANCE & TAX",
    accent: "#A5762F",
    items: [
      { id: "settleDue", label: "Settle Due", icon: "🤝" },
      { id: "charges", label: "Charges", icon: "💰" },
      { id: "discount", label: "Discount", icon: "％" },
      { id: "exemptTax", label: "Exempt Tax", icon: "🚫" },
      { id: "markPrepaid", label: "Mark Prepaid", icon: "💵" },
      { id: "deposit", label: "Deposit", icon: "💰" },
      { id: "log", label: "Log", icon: "📜" },
    ],
  },
  {
    title: "FINANCE & DOC",
    accent: "#2E5C8A",
    items: [
      { id: "viewFolio", label: "View Folio", icon: "📄" },
      { id: "printInvoice", label: "Print Invoice", icon: "🖨️" },
      { id: "printGrc", label: "Print GRC", icon: "🖨️" },
      { id: "documents", label: "Documents", icon: "📁" },
      { id: "email", label: "Email", icon: "✉️" },
    ],
  },
  {
    title: "OPERATIONS & DOCS",
    accent: "#5A5FC7",
    items: [
      { id: "checkIn", label: "Check In", icon: "✅" },
      { id: "checkOut", label: "Check Out", icon: "❌" },
      { id: "unassign", label: "Unassign", icon: "🔗" },
      { id: "assignRoom", label: "Assign Room", icon: "🔗" },
      { id: "viewInvoice", label: "View Invoice", icon: "🛏️" },
      { id: "printInvoiceEmail", label: "Print Invoice Email", icon: "🖨️" },
      { id: "documentsOps", label: "Documents", icon: "📁", aliasOf: "documents" },
      { id: "addExtra", label: "Add Extra", icon: "🛏️" },
      { id: "miscOperations", label: "Misc Sales & Expenses", icon: "🧾" },
    ],
  },
];

// title: shown as "{Label} - {Guest name}" in the small popup header (matches
// the reference screenshots). fields drive the generic form renderer.
export const ACTION_FORMS = {
  modifyCheckIn: {
    label: "Modify Check In",
    fields: [
      { name: "checkIn", label: "Date", type: "date", fromBooking: "checkIn" },
      { name: "checkInTime", label: "New Check-In Time", type: "time", fromBooking: "checkInTime" },
    ],
    submitLabel: "Save",
  },
  modifyCheckout: {
    label: "Modify Checkout",
    fields: [
      { name: "checkOut", label: "Date", type: "date", fromBooking: "checkOut" },
      { name: "checkOutTime", label: "New Check-Out Time", type: "time", fromBooking: "checkOutTime" },
    ],
    submitLabel: "Save",
  },
  moveRoom: {
    label: "Move Room",
    fields: [
      { name: "room", label: "Select New Room", type: "room-select" },
    ],
    submitLabel: "Move Room",
    infoLine: (booking) => `Current Room: ${booking.room}`,
  },
  assignRoom: {
    label: "Assign Room",
    fields: [
      { name: "room", label: "Select Room", type: "room-select" },
    ],
    submitLabel: "Assign Room",
    infoLine: (booking) => `Current Room: ${booking.room}`,
  },
  undo: {
    label: "Undo Last Action",
    confirmOnly: true,
    confirmText: (booking, ctx) => `Are you sure you want to undo: [${ctx?.lastActionLabel || "last change"}]?`,
    submitLabel: "Confirm Undo",
  },
  delete: {
    label: "Delete Reservation",
    confirmOnly: true,
    dangerous: true,
    confirmText: () => "Deleting this reservation is permanent!",
    submitLabel: "Delete Permanently",
  },
  noShow: {
    label: "Mark as No Show",
    fields: [{ name: "confirmArrival", label: "Guest did not arrive", type: "checkbox" }],
    submitLabel: "Confirm No Show",
  },
  enquiry: {
    label: "Reservation Enquiry",
    fields: [{ name: "message", label: "Notes/Message", type: "textarea" }],
    submitLabel: "Send Enquiry",
  },
  block: {
    label: "Block Room (Out of Order)",
    fields: [
      { name: "blockReason", label: "Block Reason", type: "select", options: ["Maintenance / Plumbing", "Deep Cleaning", "Out of Order (OOO)", "VIP Reserved Hold", "Renovation"] },
      { name: "checkIn", label: "Block From Date", type: "date", fromBooking: "checkIn" },
      { name: "checkOut", label: "Block To Date", type: "date", fromBooking: "checkOut" },
      { name: "notes", label: "Housekeeping Notes", type: "textarea", fromBooking: "notes" },
    ],
    submitLabel: "Confirm Block Room",
  },
  unblock: {
    label: "Unblock Reservation",
    confirmOnly: true,
    confirmText: (booking) => `Unblock Room ${booking.room} for ${booking.guest}? The room will become available again.`,
    submitLabel: "Unblock",
  },
  editReservation: { external: "editReservation" },
  addGuest: {
    label: "Add Guest",
    fields: [
      { name: "adults", label: "Adults", type: "number", min: 1, fromBooking: "adults" },
      { name: "children", label: "Children", type: "number", min: 0, fromBooking: "children" },
      { name: "infants", label: "Infants", type: "number", min: 0, fromBooking: "infants" },
    ],
    submitLabel: "Save Guests",
  },
  editGuest: {
    label: "Edit Contact Information",
    fields: [
      { name: "guest", label: "Name", type: "text", fromBooking: "guest" },
      { name: "email", label: "Email", type: "email", fromBooking: "email" },
      { name: "phone", label: "Phone", type: "text", fromBooking: "phone" },
      { name: "address", label: "Address", type: "textarea", fromBooking: "address" },
    ],
    submitLabel: "Save Contact Info",
  },
  guestDetails: {
    label: "Guest Details",
    fields: [
      { name: "nationality", label: "Nationality", type: "text", fromBooking: "nationality" },
      { name: "companyName", label: "Company", type: "text", fromBooking: "companyName" },
      { name: "idType", label: "ID Type", type: "text", fromBooking: "idType" },
      { name: "idNumber", label: "ID Number", type: "text", fromBooking: "idNumber" },
    ],
    submitLabel: "Save",
  },
  scanId: {
    label: "Scan ID",
    fields: [
      { name: "idType", label: "ID Type", type: "text", fromBooking: "idType" },
      { name: "idNumber", label: "ID Number", type: "text", fromBooking: "idNumber" },
    ],
    submitLabel: "Save Scanned ID",
  },
  scanSignature: {
    label: "Scan Signature",
    fields: [{ name: "signatureOnFile", label: "Signature captured on file", type: "checkbox" }],
    submitLabel: "Save Signature",
  },
  addNotes: {
    label: "Add Notes",
    fields: [{ name: "notes", label: "Notes", type: "textarea", fromBooking: "notes" }],
    submitLabel: "Save Notes",
  },
  settleDue: {
    label: "Settle Due",
    fields: [
      { name: "amount", label: "Amount", type: "number", min: 1 },
      { name: "mode", label: "Mode", type: "select", options: ["Cash", "Card", "UPI"] },
    ],
    submitLabel: "Settle Due",
    infoLine: (booking) => `Balance Due: $${booking.balanceDue ?? 0}`,
  },
  charges: {
    label: "Charges",
    fields: [
      { name: "label", label: "Charge Label", type: "text" },
      { name: "amount", label: "Amount", type: "number", min: 1 },
    ],
    submitLabel: "Add Charge",
  },
  addExtra: {
    label: "Add Extra",
    fields: [
      { name: "label", label: "Extra Label", type: "text" },
      { name: "amount", label: "Amount", type: "number", min: 1 },
    ],
    submitLabel: "Add Extra",
  },
  discount: {
    label: "Discount",
    fields: [{ name: "discountPercent", label: "Discount %", type: "number", min: 0, max: 100, fromBooking: "discountPercent" }],
    submitLabel: "Apply Discount",
  },
  exemptTax: {
    label: "Exempt Tax",
    confirmOnly: true,
    confirmText: (booking) => `Exempt ${booking.guest} from tax on this reservation?`,
    submitLabel: "Exempt Tax",
  },
  markPrepaid: {
    label: "Mark Prepaid",
    confirmOnly: true,
    confirmText: (booking) => `Mark the full balance ($${booking.balanceDue ?? 0}) as prepaid?`,
    submitLabel: "Mark Prepaid",
  },
  deposit: {
    label: "Deposit",
    fields: [
      { name: "amount", label: "Deposit Amount", type: "number", min: 1 },
      { name: "mode", label: "Mode", type: "select", options: ["Cash", "Card", "UPI"] },
    ],
    submitLabel: "Record Deposit",
  },
  log: { external: "log" },
  viewFolio: { external: "viewFolio" },
  printInvoice: { external: "printInvoice" },
  printGrc: { external: "printInvoice" },
  viewInvoice: { external: "printInvoice" },
  printInvoiceEmail: { external: "email" },
  email: { external: "email" },
  documents: {
    label: "Documents",
    readOnly: true,
    fields: [
      { name: "idScanned", label: "ID Scanned", type: "checkbox-readonly", fromBooking: "idScanned" },
      { name: "signatureOnFile", label: "Signature on File", type: "checkbox-readonly", fromBooking: "signatureOnFile" },
    ],
    submitLabel: "Close",
  },
  checkIn: {
    label: "Check In",
    confirmOnly: true,
    confirmText: (booking) => `Check in ${booking.guest} to Room ${booking.room} now?`,
    submitLabel: "Confirm Check In",
  },
  checkOut: {
    label: "Check Out",
    confirmOnly: true,
    confirmText: (booking) => `Check out ${booking.guest} from Room ${booking.room} now?`,
    submitLabel: "Confirm Check Out",
  },
  unassign: {
    label: "Unassign Room",
    confirmOnly: true,
    confirmText: (booking) => `Room ${booking.room} is currently assigned to this reservation. Use Move Room to reassign it to a different room — a reservation always needs one room on file.`,
    submitLabel: "Open Move Room",
    redirectsTo: "moveRoom",
  },
};

export function resolveActionId(id) {
  const item = MENU_GROUPS.flatMap((g) => g.items).find((i) => i.id === id);
  return item?.aliasOf || id;
}
