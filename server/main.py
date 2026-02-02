from core.app import creat_app

app = creat_app()

# --- Ponto de entrada ---
if __name__ == '__main__':
    print("==========================================================")
    print("Iniciando servidor Flask...")
    print("Para ver a aplicação, abra este link no seu NAVEGADOR:")
    print(f"   >>> http://127.0.0.1:5000 <<<")
    print("==========================================================")
    app.run(debug=True, port=5000)