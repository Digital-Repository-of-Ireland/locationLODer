declare namespace sparql="http://www.w3.org/2005/sparql-results#";
declare namespace xsi="http://www.w3.org/2001/XMLSchema-instance";

<kml xmlns="http://www.opengis.net/kml/2.2"><Document>
     <Style id="normalPlacemark">
       <IconStyle>
         <Icon>
           <href>http://maps.google.com/mapfiles/ms/icons/red-dot.png</href>
         </Icon>
       </IconStyle>
     </Style>
{
for $result in doc("results.xml")//sparql:result
return <Placemark>
        <styleUrl>#normalPlacemark</styleUrl>
        <ExtendedData>{
        for $binding in $result//sparql:binding
        return element {"Data"} { $binding/@name, <value>{$binding/*/text()}</value>}
}</ExtendedData>
        <Point><coordinates>{$result//sparql:binding[@name="long"]/*/text()},{$result//sparql:binding[@name="lat"]/*/text()},0</coordinates></Point>
</Placemark>

}</Document></kml>
