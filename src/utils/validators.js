export function isValidEmail(email) {
  return /^\S+@\S+\.\S+$/.test(String(email).trim());
}

export function onlyDigits(value) {
  return String(value ?? '').replace(/\D/g, '');
}

export function isValidCpfShape(cpf) {
  // Validação leve para o MVP. Na versão final, validar dígitos verificadores no backend.
  return onlyDigits(cpf).length === 11;
}

export function isValidPhoneShape(phone) {
  return onlyDigits(phone).length >= 10;
}
