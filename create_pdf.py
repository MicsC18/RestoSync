from reportlab.pdfgen import canvas

c = canvas.Canvas("/home/nscaramella/restosync/RestoSync/ticket_prueba.pdf")
c.drawString(100, 750, "MAYORISTA MAXICONSUMO")
c.drawString(100, 730, "Fecha: 15/10/2026")
c.drawString(100, 700, "10 x Leche Larga Vida 1L (Vence: 20/12/2026)")
c.drawString(100, 680, "5 x Queso Cheddar Feteado 500g")
c.drawString(100, 660, "2 x Cajón Tomates Perita")
c.drawString(100, 640, "1 x Levadura Fresca 500g (Vence: 30/10/2026)")
c.save()
