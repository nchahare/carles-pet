@echo off
rem Starts Carles on the taskbar. Double-click it, or run it from a terminal.
rem Needs Python 3 with tkinter (the normal python.org installer has it).
where pythonw >nul 2>nul && (start "" pythonw -I "%~dp0carles_pet.py" & exit /b)
where pyw >nul 2>nul && (start "" pyw -3 -I "%~dp0carles_pet.py" & exit /b)
echo Python 3 was not found. Install it from https://www.python.org/ and try again.
pause
