import os
import subprocess
import webbrowser
import time
import sys

def main():
    print("======================================================")
    print("          INICIANDO TRADINGVIEW GRATIS (PYTHON)")
    print("======================================================\n")

    # Ruta del proyecto
    project_dir = r"c:\Users\Kelvin\Documents\tradingview-gratis"
    
    # Cambiar al directorio del proyecto
    try:
        os.chdir(project_dir)
    except Exception as e:
        print(f"[ERROR] No se pudo acceder a la ruta {project_dir}: {e}")
        input("Presiona Enter para salir...")
        sys.exit(1)

    # Verificar si existe node_modules
    if not os.path.exists("node_modules"):
        print("[INFO] No se detecto la carpeta node_modules. Instalando dependencias...")
        print("Esto puede tardar un momento en la primera ejecucion...")
        try:
            subprocess.run("npm install", shell=True, check=True)
        except subprocess.CalledProcessError as e:
            print(f"[ERROR] Error al instalar dependencias npm: {e}")
            input("Presiona Enter para salir...")
            sys.exit(1)

    # Abrir el navegador
    print("\n[INFO] Abriendo el navegador en http://localhost:3000 ...")
    webbrowser.open("http://localhost:3000")

    # Iniciar el servidor local
    print("[INFO] Iniciando el servidor local...")
    try:
        subprocess.run("npm run dev", shell=True)
    except KeyboardInterrupt:
        print("\n[INFO] Servidor detenido por el usuario.")
    except Exception as e:
        print(f"[ERROR] Ocurrio un error al ejecutar la aplicacion: {e}")
        input("Presiona Enter para salir...")

if __name__ == "__main__":
    main()
