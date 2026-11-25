/** A Philippine mobile number grouped for reading aloud (`+63 917 123 4567`); any other as stored. */
export function displayPhone(phone: string): string {
  const mobile = /^\+63(9\d{2})(\d{3})(\d{4})$/.exec(phone);
  return mobile ? `+63 ${mobile.slice(1).join(' ')}` : phone;
}
