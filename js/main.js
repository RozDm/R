window.addEventListener("load", () => {
    const preloader = document.getElementById("preloader");
    const content = document.getElementById("content");

    // Убираем прелоадер через 5 секунд после завершения анимации
    setTimeout(() => {
        preloader.style.opacity = "0"; // Плавное исчезновение прелоадера
        preloader.style.transition = "opacity 0.3s";

        // Полное удаление через 0.5 секунды
        setTimeout(() => {
            preloader.style.display = "none";
            content.style.opacity = "1"; // Показываем контент
            document.body.style.overflow = "auto"; // Включаем прокрутку
        }, 500);
    }, 5000); // Ждём завершения анимации (5 секунд)
});
