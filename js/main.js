window.addEventListener("load", () => {
    const preloader = document.getElementById("preloader");
    const content = document.getElementById("content");

    // Найдём элемент с кругом
    const circle = document.querySelector(".circle");

    // Обрабатываем событие завершения анимации круга
    circle.addEventListener("animationend", () => {
        // Плавно скрываем прелоадер
        preloader.style.opacity = "0"; // Прелоадер исчезает
        preloader.style.transition = "opacity 0.3s ease";

        // Убираем прелоадер и показываем контент
        setTimeout(() => {
            preloader.style.display = "none"; // Полностью убираем прелоадер
            content.style.opacity = "1"; // Показываем контент
            content.style.visibility = "visible"; // Убираем `visibility: hidden`
            document.body.style.overflow = "auto"; // Включаем прокрутку
        }, 300); // Подождём, пока исчезнет прелоадер
    });
});
