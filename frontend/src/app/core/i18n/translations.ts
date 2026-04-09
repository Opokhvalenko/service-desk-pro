export type Locale = 'en' | 'uk';

export const TRANSLATIONS: Record<string, Record<Locale, string>> = {
  // Toolbar
  'nav.dashboard': { en: 'Dashboard', uk: 'Дашборд' },
  'nav.tickets': { en: 'Tickets', uk: 'Заявки' },
  'nav.queue': { en: 'Queue', uk: 'Черга' },
  'nav.myTickets': { en: 'My tickets', uk: 'Мої заявки' },
  'nav.reports': { en: 'Reports', uk: 'Звіти' },
  'nav.admin': { en: 'Admin', uk: 'Адмін' },
  'nav.profile': { en: 'Profile', uk: 'Профіль' },
  'nav.signOut': { en: 'Sign out', uk: 'Вийти' },
  'nav.notifications': { en: 'Notifications', uk: 'Сповіщення' },

  // Theme + locale toggles
  'toggle.theme.light': { en: 'Switch to light theme', uk: 'Світла тема' },
  'toggle.theme.dark': { en: 'Switch to dark theme', uk: 'Темна тема' },
  'toggle.locale': { en: 'Change language', uk: 'Змінити мову' },

  // Login
  'login.title': { en: 'Sign in', uk: 'Вхід' },
  'login.email': { en: 'Email', uk: 'Електронна пошта' },
  'login.password': { en: 'Password', uk: 'Пароль' },
  'login.submit': { en: 'Sign in', uk: 'Увійти' },
  'login.error': { en: 'Invalid email or password', uk: 'Невірний email або пароль' },

  // Common
  'common.loading': { en: 'Loading…', uk: 'Завантаження…' },
  'common.error': { en: 'Something went wrong', uk: 'Сталася помилка' },
  'common.empty': { en: 'No data', uk: 'Немає даних' },
  'common.save': { en: 'Save', uk: 'Зберегти' },
  'common.cancel': { en: 'Cancel', uk: 'Скасувати' },
  'common.delete': { en: 'Delete', uk: 'Видалити' },
  'common.edit': { en: 'Edit', uk: 'Редагувати' },
  'common.create': { en: 'Create', uk: 'Створити' },
};
