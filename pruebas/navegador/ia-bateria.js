// Batería para medir qué tan bien entiende Finti (Pregúntale y "Cuéntame un gasto"), con frases como las escribe la
// gente en Colombia: sin tildes, con jerga, con errores de dedo y como se dicen en voz alta. Cada pregunta dice qué
// intención se espera (o varias que también sirven). "" significa que no es de plata: lo correcto es no inventar.
// La usan pruebas/navegador/ia-evaluacion.test.js (con un mínimo que no puede bajar) y quien quiera medir mejoras.
module.exports.PREGUNTAS = [
  // Saldos y plata disponible
  ["cuanta plata tengo", "saldos"], ["cuánto dinero tengo en total", "saldos"], ["cual es mi saldo", "saldos"],
  ["cuanto tengo en nequi", "saldos"], ["cuanta plata hay en el banco", "saldos"], ["cuanto billete tengo", "saldos"],
  ["mostrame mis cuentas", "saldos"], ["cuanto tengo en efectivo", "saldos"], ["cuanto me queda en daviplata", "saldos"],
  ["cuanto me queda este mes", "disponible"], ["cuanto puedo gastar todavia", ["disponible", "hoy"]], ["me sobra algo", "disponible"],
  ["cuanta plata me queda libre", "disponible"], ["cuanto me queda para gastar", "disponible"], ["tengo plata disponible?", "disponible"],
  ["cuanto puedo gastar hoy", "hoy"], ["que me puedo gastar hoy", "hoy"], ["hoy cuanto puedo gastar", "hoy"], ["cuanto tengo para hoy", "hoy"],
  ["cuanto me queda hasta la quincena", "quincena"], ["me alcanza hasta que me paguen", ["quincena", "alcanza"]], ["como llego al 30", "quincena"],
  // Gastos
  ["cuanto gaste este mes", "gasto"], ["cuanto llevo gastado", "gasto"], ["cuanto he gastado en comida", "gasto"], ["cuanto se me ha ido en transporte", "gasto"],
  ["cuanto gaste en rappi", "gasto"], ["cuanto gaste ayer", "gasto"], ["cuanto gaste la semana pasada", "gasto"], ["gastos de octubre", "gasto"],
  ["cuanto me gaste en uber", "gasto"], ["cuanto se me fue en domicilios", "gasto"], ["cuanto pago de arriendo", "gasto"], ["cuanto gasto en servicios", "gasto"],
  ["que tanto he gastado en ropa", "gasto"], ["cuanto invierto en el carro", "gasto"], ["cuanto me cuesta la comida al mes", "gasto"],
  ["cuamto gaste en comida", "gasto"], ["cuanto gasté en el mercado esta semana", "gasto"], ["plata que se me fue en salidas", "gasto"],
  ["en que gasto mas", "top"], ["en que se me va la plata", "top"], ["donde se me va el dinero", "top"], ["cuales son mis mayores gastos", "top"],
  ["en que se me fue la plata este mes", "top"], ["que es lo que mas me cuesta", "top"], ["en que estoy botando la plata", "top"],
  ["cual fue mi gasto mas grande", "mayor"], ["cual fue la compra mas cara", "mayor"], ["lo mas caro que compre", "mayor"],
  ["cuanto gasto al dia", "promedio"], ["cuanto gasto en promedio", "promedio"], ["gasto diario", "promedio"],
  ["cuanto se me va en gastos hormiga", "hormiga"], ["gastos pequeños", "hormiga"], ["en que gasto de a poquito", "hormiga"], ["los gastos chiquitos", "hormiga"],
  ["que dia gasto mas", "habitos"], ["a que hora gasto mas", "habitos"], ["tengo algun patron de gasto", "habitos"], ["cuales son mis habitos", "habitos"],
  // Comparar y cómo va
  ["como voy este mes", ["estado", "comparar"]], ["voy bien?", ["estado", "comparar"]], ["estoy gastando mucho?", "comparar"],
  ["gaste mas que el mes pasado", "comparar"], ["comparame con el mes pasado", "comparar"], ["como voy frente a mi presupuesto", ["comparar", "estado"]],
  ["como cierro el mes", "cierre"], ["como voy a terminar el mes", "cierre"], ["voy a quedar en rojo?", "cierre"], ["me va a alcanzar el mes", ["cierre", "alcanza"]],
  ["como esta mi salud financiera", "salud"], ["como estan mis finanzas", "salud"], ["estoy bien de plata?", ["salud", "estado"]],
  // Ingresos y ahorro
  ["cuanto gano", "ingresos"], ["cuanto me ha entrado este mes", "ingresos"], ["cuanto me pagaron", "ingresos"], ["cual es mi sueldo", "ingresos"], ["cuanto recibi en octubre", "ingresos"],
  ["cuanto estoy ahorrando", "ahorro"], ["cuanto he ahorrado", "ahorro"], ["cuanto deberia ahorrar al mes", ["ahorro", "consejo"]], ["cuanto ahorro al mes", "ahorro"],
  ["cuando llego a mi meta", "metas"], ["como van mis metas", "metas"], ["cuanto me falta para el viaje", ["metas", "alcanza"]], ["cuanto me falta para la moto", "metas"],
  // ¿Me alcanza?
  ["me alcanza para unos tenis de 300 mil", "alcanza"], ["puedo comprar un celular de 1 millon", "alcanza"], ["me alcanza para un viaje de 2 millones", "alcanza"],
  ["puedo gastarme 200 lucas en una fiesta", "alcanza"], ["si compro un televisor de 1.500.000 como quedo", "alcanza"], ["me puedo dar un gusto de 80 mil", "alcanza"],
  // Pagos y deudas
  ["que tengo que pagar esta semana", "pagos"], ["que pagos tengo pendientes", "pagos"], ["cuando vence la tarjeta", "pagos"], ["que debo pagar mañana", "pagos"],
  ["tengo algo por pagar", "pagos"], ["cuando pago la luz", "pagos"], ["que se me vence", "pagos"],
  ["cuanto debo", "deudas"], ["cuanto debo en total", "deudas"], ["que deuda pago primero", "deudas"], ["cuanto me falta para pagar el credito", "deudas"], ["como salgo de deudas", ["deudas", "consejo"]],
  ["cuanto me deben", "medeben"], ["quien me debe plata", "medeben"], ["cuanto me falta por cobrar", "medeben"],
  // Consejos y productos
  ["que me recomiendas", "consejo"], ["como puedo ahorrar mas", ["consejo", "ahorro"]], ["dame un consejo", "consejo"], ["en que puedo recortar", "consejo"],
  ["como gasto menos", "consejo"], ["tips para ahorrar", ["consejo", "ahorro"]], ["como hago para que me rinda la plata", "consejo"], ["ayudame a organizarme", ["consejo", "ayuda"]],
  ["que es lo que mas compro", "productos"], ["subio el mercado?", "productos"], ["como esta la canasta", "productos"],
  ["cuanto gaste en leche", ["producto", "gasto"]], ["a como esta la papa", "producto"], ["donde compro el arroz mas barato", ["producto", "accion"]], ["como esta el tomate", "producto"],
  // Charla
  ["hola", "saludo"], ["buenas tardes", "saludo"], ["quiubo", "saludo"], ["gracias", "gracias"], ["listo gracias", "gracias"],
  ["que puedo preguntarte", "ayuda"], ["que sabes hacer", "ayuda"], ["como funcionas", "ayuda"],
  // Con más palabras, como se habla
  ["oye finti cuanto fue lo que gaste en comida este mes", "gasto"], ["necesito saber cuanto me queda de plata", ["disponible", "saldos"]],
  ["quiero saber en que se me esta yendo la plata", "top"], ["me podrias decir cuanto debo", "deudas"], ["por favor dime si voy bien este mes", ["estado", "comparar"]],
  ["será que me alcanza para comprar unos audifonos de 150", "alcanza"], ["que me toca pagar esta semana", "pagos"], ["parce cuanto me gaste en rumba", "gasto"],
  ["cuanta plata se me ha ido en taxis este mes", "gasto"], ["cuanto llevo en domicilios", "gasto"], ["cuanto me ha costado el gimnasio", "gasto"],
  // Errores de dedo y sin espacios
  ["cuanto gaste en comdia", "gasto"], ["cuanta pata tengo", "saldos"], ["en q gasto mas", "top"], ["q me recomiendas", "consejo"], ["cuanto dbo", "deudas"],
  ["cuantoo me queda", "disponible"], ["cuanto gate este mes", "gasto"], ["ke tengo q pagar", "pagos"],
  // Fuera de tema: lo correcto es no inventar una respuesta de plata
  ["cual es la capital de francia", ""], ["cuentame un chiste", ""], ["quien gano el partido", ""], ["que hora es", ""], ["como esta el clima", ""],
];

// Gastos e ingresos contados: [frase, monto esperado, categoría esperada (o varias), tipo "g" o "i" (opcional)]
module.exports.CHARLA = [
  ["almuerzo 15 mil", 15000, "alimentacion"], ["me gaste 20 lucas en el bus", 20000, "transporte"], ["taxi de 12", 12000, "transporte"],
  ["pague el arriendo de 900 mil", 900000, "vivienda"], ["pague la luz 85.000", 85000, "servicios"], ["netflix 26900", 26900, "suscripciones"],
  ["mercado en el d1 por 180 mil", 180000, "alimentacion"], ["gasolina 50 mil", 50000, "transporte"], ["un tinto de 2500", 2500, "alimentacion"],
  ["medicamentos en la drogueria 45 mil", 45000, "salud"], ["cuota del celular 120 mil", 120000, ["deudas", "servicios"]], ["matricula de la u 2 millones", 2000000, "educacion"],
  ["cine con la novia 60 mil", 60000, "ocio"], ["regalo para mi mama 80 mil", 80000, "compras"],
  ["me pagaron el sueldo 2.500.000", 2500000, null, "i"], ["me entraron 300 mil de un trabajito", 300000, null, "i"], ["recibi la prima de 1 millon", 1000000, null, "i"],
  ["uber al trabajo 18 mil", 18000, "transporte"], ["domicilio de rappi 35 mil", 35000, ["alimentacion", "ocio"]], ["spotify 16900", 16900, "suscripciones"],
  ["internet 95 mil", 95000, "servicios"], ["pase del transmilenio 3200", 3200, "transporte"], ["parqueadero 8 mil", 8000, "transporte"],
  ["cerveza con los amigos 40 mil", 40000, "ocio"], ["corte de pelo 25 mil", 25000, ["compras", "otros", "salud"]], ["peaje 12.500", 12500, "transporte"],
  ["pago de la tarjeta de credito 400 mil", 400000, "deudas"], ["ahorre 200 mil", 200000, "ahorro"], ["empanadas 6 mil", 6000, "alimentacion"],
  ["gaste 1,5 millones en un computador", 1500000, "compras"], ["medio millon en mercado", 500000, "alimentacion"], ["un palo en el arriendo", 1000000, "vivienda"],
  ["pague 150 de agua", 150000, "servicios"], ["almorce por 14.000", 14000, "alimentacion"], ["mecato 5 mil", 5000, "alimentacion"],
  ["comida para el perro 70 mil", 70000, ["otros", "alimentacion", "compras"]], ["gimnasio 90 mil", 90000, ["salud", "ocio", "suscripciones"]],
  ["seguro del carro 180 mil", 180000, ["transporte", "otros"]], ["pasajes a cali 120 mil", 120000, ["transporte", "ocio"]], ["libros de la universidad 200 mil", 200000, "educacion"],
  ["recarga del celular 20 mil", 20000, "servicios"], ["me gaste 30 en un almuerzo", 30000, "alimentacion"], ["pan y leche 9 mil", 9000, "alimentacion"],
  ["un tinto de 800", 800, "alimentacion"], ["unos tenis de 250", 250000, "compras"], ["la cuota del carro 850", 850000, "deudas"],
  ["vendi la bicicleta por 400 mil", 400000, null, "i"], ["me devolvieron 50 mil", 50000, null, "i"], ["me prestaron 200 mil", 200000, null, "i"],
];

// Control: frases distintas, escritas antes de mejorar el motor y que no se usan para ajustarlo. Sirven para comprobar
// que una mejora generaliza y no solo se acomoda a las preguntas de arriba.
module.exports.CONTROL = [
  ["cuanta lana tengo", "saldos"], ["que saldo tengo en bancolombia", "saldos"], ["dime mis saldos", "saldos"], ["cuanto hay en mis cuentas", "saldos"],
  ["cuanto me resta del mes", "disponible"], ["que tanto me queda", "disponible"], ["cuanto puedo gastar en lo que queda del mes", "disponible"],
  ["de cuanto dispongo hoy", "hoy"], ["cuanto me puedo gastar hoy sin pasarme", "hoy"],
  ["cuanto aguanto hasta el pago", "quincena"], ["me alcanza la plata hasta la quincena", ["quincena", "alcanza"]],
  ["cuanto he gastado en mercado", "gasto"], ["cuanto se me fue en gasolina", "gasto"], ["cuanto gaste el mes pasado", "gasto"], ["gasto en salud", "gasto"],
  ["cuanto llevo en ocio", "gasto"], ["cuanto me ha salido el transporte", "gasto"], ["cuanto pague de servicios", "gasto"],
  ["que se lleva la mayor parte de mi plata", "top"], ["cuales son mis gastos mas grandes", "top"], ["en que me estoy gastando todo", "top"],
  ["cual ha sido mi compra mas grande", "mayor"], ["cuanto es mi gasto por dia", "promedio"], ["cuanto me cuestan los antojos", "hormiga"],
  ["que dias se me va mas plata", "habitos"], ["voy peor que el mes pasado?", "comparar"], ["estoy gastando mas de lo normal", "comparar"],
  ["como me va a ir a fin de mes", "cierre"], ["termino el mes con plata?", "cierre"], ["mi situacion financiera como esta", "salud"],
  ["cuanto me ingreso este mes", "ingresos"], ["cuanto llevo ahorrado", "ahorro"], ["cuanto me falta para mi meta", "metas"],
  ["puedo comprarme una bicicleta de 800 mil", "alcanza"], ["me da para unos zapatos de 120", "alcanza"],
  ["que pagos vienen", "pagos"], ["cuando tengo que pagar el internet", "pagos"], ["que cuentas tengo por pagar", "pagos"],
  ["cuanta deuda tengo", "deudas"], ["a quien le debo", "deudas"], ["cuanto me deben mis amigos", "medeben"],
  ["como ahorro mas plata", ["consejo", "ahorro"]], ["que puedo hacer para gastar menos", "consejo"], ["dame ideas para ahorrar", ["consejo", "ahorro"]],
  ["que productos compro mas", "productos"], ["cuanto vale el huevo", "producto"],
  ["buenos dias", "saludo"], ["muchas gracias finti", "gracias"], ["que cosas te puedo preguntar", "ayuda"],
  ["cuanto gsate en comida", "gasto"], ["cuant debo", "deudas"], ["q pagos tengo", "pagos"], ["kuanto me queda", "disponible"],
  ["recomiendame una pelicula", ""], ["como se hace una arepa", ""], ["cuantos años tienes", ""],
];

// Ciega: escrita después de las mejoras y antes de volver a medir; no se usa para ajustar nada.
module.exports.CIEGA = [
  ["cuanto efectivo tengo", "saldos"], ["mis saldos por favor", "saldos"], ["cuanto queda en mi cuenta de ahorros", "saldos"],
  ["que me queda para lo que resta del mes", "disponible"], ["cuanto me puedo gastar este mes todavia", "disponible"],
  ["me alcanza el billete hasta el pago", ["quincena", "alcanza"]], ["cuanta plata puedo usar hoy", "hoy"],
  ["cuanto llevo gastado en comida esta semana", "gasto"], ["cuanto se me ha ido en arriendo este año", "gasto"], ["cuanto pagué de internet", "gasto"],
  ["cuanto me gasté en rumba en octubre", "gasto"], ["gastos en transporte del mes pasado", "gasto"],
  ["donde se esta yendo mi sueldo", "top"], ["que es lo que mas plata me quita", "top"], ["cual fue el gasto mas alto del mes", "mayor"],
  ["cuanto gasto diariamente", "promedio"], ["los gastos hormiga del mes", "hormiga"], ["que habitos de gasto tengo", "habitos"],
  ["gasto mas o menos que antes?", "comparar"], ["como termino este mes", "cierre"], ["como esta mi plata en general", ["salud", "estado"]],
  ["cuanto me entro de sueldo", "ingresos"], ["cuanto plata he guardado", "ahorro"], ["voy bien con mi meta del carro?", "metas"],
  ["me alcanza para un celular de 900 mil", "alcanza"], ["que cuentas se me vencen esta semana", "pagos"], ["cuanto le debo al banco", "deudas"],
  ["quienes me deben plata", "medeben"], ["que hago para ahorrar mas", ["consejo", "ahorro"]], ["que he comprado mas veces", "productos"],
  ["holaa", "saludo"], ["muchas grax", "gracias"], ["como te uso", "ayuda"],
  ["cuanot gaste hoy", "gasto"], ["q deudas tengo", "deudas"], ["cuanto me qeda", "disponible"],
  ["quien es el presidente", ""], ["dime una receta", ""], ["que dia es hoy", ""],
];

// Ciega 2: escrita al final, después de todas las mejoras, y medida una sola vez sin ajustar nada (27 de noviembre de 2026).
module.exports.CIEGA2 = [
  ["cuanto dinero me queda en la cuenta", "saldos"], ["que plata tengo ahorita", "saldos"], ["cuanto hay en el banco", "saldos"],
  ["cuanto puedo seguir gastando este mes", "disponible"], ["me queda algo para el resto del mes", "disponible"],
  ["cuanto me puedo gastar hoy en la calle", "hoy"], ["llego a la quincena?", "quincena"],
  ["cuanto me he gastado en mercado este mes", "gasto"], ["cuanto se fue en gasolina la semana pasada", "gasto"], ["cuanto gaste en ropa en septiembre", "gasto"],
  ["cuanto pagamos de luz", "gasto"], ["cuanto llevamos en domicilios", "gasto"],
  ["en que me gasto la plata", "top"], ["donde se me esta yendo el dinero", "top"], ["que fue lo mas caro que pague", "mayor"],
  ["cuanto gasto cada dia", "promedio"], ["cuanto se me va en cafecitos y antojos", "hormiga"], ["que dia de la semana compro mas", "habitos"],
  ["gaste menos que el mes anterior?", "comparar"], ["voy a terminar el mes con saldo positivo?", "cierre"], ["que tan bien estoy con la plata", ["salud", "estado"]],
  ["cuanto me pagan al mes", "ingresos"], ["cuanto llevo guardado", "ahorro"], ["cuanto me falta para completar lo del viaje", ["metas", "alcanza"]],
  ["puedo comprar una nevera de 2 millones", "alcanza"], ["que facturas tengo pendientes", "pagos"], ["cuanto debo de la tarjeta", "deudas"],
  ["cuanto me debe juan", "medeben"], ["como puedo gastar menos en comida", "consejo"], ["que productos he comprado", "productos"],
  ["buenas noches", "saludo"], ["mil gracias", "gracias"], ["que preguntas te puedo hacer", "ayuda"],
  ["cuanto gastw en comida", "gasto"], ["cuanto tngo en nequi", "saldos"], ["q tengo pendiente por pagar", "pagos"],
  ["cual es tu color favorito", ""], ["como se llama mi perro", ""], ["ponme musica", ""],
];

// Ciega 3 (examen final): escrita el 28 de noviembre de 2026 ANTES de entrenar el clasificador, sin mirar sus
// plantillas ni el motor. No se usa para entrenar ni para ajustar nada.
module.exports.CIEGA3 = [
  ["con cuanta plata cuento en este momento", "saldos"], ["revisame el saldo de mis cuentas", "saldos"], ["cuanto dinero tengo guardado en el banco", ["saldos", "ahorro"]],
  ["cuanto efectivo me queda en la billetera", "saldos"], ["que tanto dinero hay en nequi", "saldos"],
  ["cuanto presupuesto me queda libre", "disponible"], ["cuanto me falta por gastar del presupuesto", "disponible"], ["aun me queda plata este mes", "disponible"],
  ["que puedo gastarme el dia de hoy", "hoy"], ["cual es mi limite para hoy", "hoy"],
  ["la plata me dura hasta la quincena", ["quincena", "alcanza"]], ["cuanto tengo para aguantar hasta el pago", "quincena"],
  ["cuanto me ha costado el mercado este mes", "gasto"], ["dime lo que gaste en transporte", "gasto"], ["cuanto se me fue en comida el mes pasado", "gasto"],
  ["total gastado en restaurantes", "gasto"], ["cuanto he pagado de servicios este año", "gasto"], ["mis gastos de salud", "gasto"],
  ["en que categoria gasto mas", "top"], ["que me esta consumiendo la plata", "top"], ["a donde se va mi plata", "top"],
  ["cual es el gasto mas grande que he hecho", "mayor"], ["mi promedio de gasto diario", "promedio"],
  ["las pequeñas compras que se suman", "hormiga"], ["cuanto me gasto en cosas pequeñas", "hormiga"],
  ["en que momento del mes gasto mas", "habitos"], ["estoy gastando mas que antes", "comparar"], ["este mes vs el anterior", "comparar"],
  ["con cuanto voy a terminar el mes", "cierre"], ["me va a sobrar plata al final del mes", "cierre"],
  ["que calificacion tienen mis finanzas", "salud"], ["cuanto he recibido este mes", "ingresos"], ["de cuanto es mi ingreso mensual", "ingresos"],
  ["cuanto estoy guardando cada mes", "ahorro"], ["voy bien con el ahorro?", "ahorro"], ["que tan cerca estoy de mi meta", "metas"],
  ["me alcanza para salir a comer de 100 mil", "alcanza"], ["puedo pagar un curso de 600 mil", "alcanza"],
  ["que se vence este mes", "pagos"], ["recuerdame mis pagos", "pagos"], ["cuanto debo en tarjetas", "deudas"], ["que creditos tengo", "deudas"],
  ["cuanta plata me deben a mi", "medeben"], ["como puedo mejorar mis finanzas", ["consejo", "salud"]], ["que me aconsejas", "consejo"],
  ["que compro con mas frecuencia", "productos"], ["que onda finti", "saludo"], ["ok gracias", "gracias"], ["en que me puedes ayudar", "ayuda"],
  ["cuanto gastee en uber", "gasto"], ["cuanta palta tengo", "saldos"], ["q me queda del mes", "disponible"],
  ["cuanto mide la torre eiffel", ""], ["escribeme un poema", ""], ["quien es messi", ""], ["traduce hola al ingles", ""],
];
