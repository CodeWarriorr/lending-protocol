### Lending platform

**For educational purpose only.**

1. Oracle
    * Stwórz prosty kontrakt oracle, którego źródłem będą ceny z chainlinka
1. Depozyty
    * Stwórz kontrakt, który będzie pozwalał dowolnemu użytkownikowi na zdeponowanie dowolnej ilości wspieranego assetu. 
    * Assety posiadają współczynnik “collateralFactor” który jest ustawiany przez Ownera. “CollateralFactor” określa jaka część wartości depozytu jest uwzględniana jako pozytywne liquidity. 
    * Kontrakt powinien umożliwiać obliczanie “liquidity” użytkownika, które można obliczyć za pomocą wzoru: ∑ {ilość assetu} * {cena assetu} * {collateralFactor}
1. Pożyczki
    * Rozszerz kontrakt o możliwość brania pożyczek. 
    * Wartość możliwej do zaciągnięcia pożyczki nie może przekraczać wartości liquidity użytkownika
    * Formuła obliczająca liquidty powinna teraz uwzględniać również pożyczki i odpowiednio zmniejszać liquidity o wartość pożyczki
1. Likwidacja
    * Użytkownik którego liquidity spadnie poniżej 0 (np. na skutek zmiany ceny zdeponowanego, lub pożyczonego assetu) może zostać zlikiwdowany
    * Likwidujący może spłacić pożyczkę likwidowanego, otrzymując w zamian jego depozyt o wartości pożyczki (z pominięciem collateralFactor!) przemnożony przez “liquidationIncentive”
    * “liquidationIncentive” jest ustalane przez Ownera i stanowi & bonus który otrzyma likwidujący
    * Może dojść do sytuacji gdzie depozyt likwidowanej osoby będzie niewystarczający do pokrycia kosztów spłaty pożyczki i bonusu. W takim przypadku likwidujący wciąż powinien mieć możliwość przeprowadzenia operacji - zlikwidowany zostanie wtedy cały depozyt likwidowanej osoby.
1. Oprocentowanie 
    * Depozyty powinny zarabiać na oprocentowaniu, które wynikać powinno z utylizacji danego assetu - czyli proporcji ilości depozytów do pożyczek
    * Pożyczki powinny obciążać pożyczających oprocentowaniem, na którym zarabiają deponujący, oraz platforma. 
    * Oprocentowanie pożyczek > Oprocentowanie depozytu
