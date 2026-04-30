export function isValidEmail(email) {
  return /^\S+@\S+\.\S+$/.test(String(email).trim());
}

export function onlyDigits(value) {
  return String(value ?? '').replace(/\D/g, '');
}


export function isValidPhoneShape(phone) {
  return onlyDigits(phone).length >= 10;
}
