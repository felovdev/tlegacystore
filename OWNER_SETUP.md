# Настройка TLegacyStore (для владельца)

Этот проект использует Firebase Authentication, Cloud Firestore и Cloud Functions. Не публикуйте service-account JSON и приватные ключи в GitHub.

## 1. Включите способы входа

Firebase Console → Authentication → Sign-in method:
- включите **Anonymous** (для гостевых посетителей);
- включите **Email/Password** (интерфейс сайта показывает только логин и пароль; внутри используется служебный адрес вида username@accounts.tlegacystore.invalid).

Пользователи могут регистрироваться только с логином из латиницы, цифр и подчёркивания, 3–24 символа. Пароль — минимум 8 символов.

## 2. Создайте Firestore

Создайте Cloud Firestore с базой `(default)`. После входа в папку проекта выполните:
```sh
firebase login
firebase use tlegacystore
firebase deploy --only firestore:rules,functions
```
Cloud Functions требуют план Firebase **Blaze** (оплата по факту использования; могут применяться бесплатные квоты). Настройте бюджетные уведомления в Google Cloud Billing.

## 3. Назначьте администратора

1. Откройте сайт и зарегистрируйте отдельный аккаунт `adminchik` с новым уникальным паролем. Не используйте пароль, который ранее отправляли в чат.
2. Создайте service-account key в Firebase Console → Project settings → Service accounts. Скачайте его на свой компьютер и не добавляйте в репозиторий.
3. Установите зависимости в корне проекта или в отдельной папке с Firebase Admin SDK.
4. Установите переменную окружения на локальном компьютере и запустите скрипт:
```sh
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/service-account.json node scripts/set-admin.js adminchik
```
В Windows PowerShell:
```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\\path\\service-account.json"
node scripts/set-admin.js adminchik
```
После назначения роли выйдите из аккаунта на сайте и войдите снова.

## 4. Важные ограничения текущего этапа

- Номера гостей выделяются транзакцией на сервере и глобально уникальны.
- При регистрации гостевой UID сохраняется, а комментарии переименовываются в выбранный логин.
- Гости не могут менять/удалять комментарии; аккаунты могут менять/удалять свои.
- Администраторские callable-функции проверяют custom claim `admin: true`.
- Для полной защиты от автоматизированных запросов дополнительно настройте Firebase App Check перед публичным запуском.
- Панель модерации, баны с интерфейсом, чат поддержки, лайки/дизлайки и аналитика просмотров/скачиваний ещё не подключены к пользовательскому интерфейсу. Не считайте их готовыми только по наличию серверных заготовок.
