export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer
      id="footer"
      className="w-full py-6 px-4 md:px-16 bg-gray-100 dark:bg-gray-800 text-center text-gray-700 dark:text-gray-300"
    >
      <p>© {currentYear} Все права защищены.</p>
    </footer>
  )
}
