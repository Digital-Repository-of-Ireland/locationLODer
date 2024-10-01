var WRAPPER_URL = window.location.href.replace("/locationLODer","").replace("#","")+'/';
console.log(window.location.href);

// fallback alert in older IE browsers
var alertFallback = true;
if (typeof console === "undefined" || typeof console.log === "undefined") {
  console = {};
  if (alertFallback) {
      console.log = function(msg) {
           alert(msg);
      };
  } else {
      console.log = function() {};
  }
}



var map;
var markers = [];
var current_marker;
var active_marker = null;

// var EUROPEANA_EP = 'http://europeana.ontotext.com/sparql.json'
var EUROPEANA_EP = 'http://sparql.europeana.eu/'
var DBPEDIA_EP = 'http://dbpedia.org/sparql/'
var LOGAINM_EP = 'http://data.logainm.ie/sparql/'

var autocomplete;

var initialSearch = true;

var streets = { 
    'http://data.logainm.ie/place/1383382': '0Aka-nSBc9znndEJzRFQtNmdveGdXb1JmUW9aRlN0UkE',  // dawson
    'http://data.logainm.ie/place/1383311': '0Aka-nSBc9znndGExYndaZWhZcjRqOVh5bDBMU2R2aFE',  // sheriff upper
    'http://data.logainm.ie/place/1383310': '0Aka-nSBc9znndFU2ZE95eVVQSTFxLU9tQktJdlB2TWc',  // sheriff lower
    'http://data.logainm.ie/place/1383633': '0Aka-nSBc9znndHZGUFdEN0dGMEJ6SmxhSWVtMzRsV2c',  // oconnel upper
    'http://data.logainm.ie/place/1383632': '0Aka-nSBc9znndDg5NXdVQW5neEdpSmN3NXdPOUcwbGc',  // oconnel lower
    'http://data.logainm.ie/place/1383248': '0Aka-nSBc9znndFpfdmUtR3YxZ3B6S3JicmFpQnZ6eGc',  // dame
    'http://data.logainm.ie/place/1383315': '0Aka-nSBc9znndHJQa2Z1SE5UdHdQcGRCWWNXOXFnRlE',  // henry
    'http://data.logainm.ie/place/1383426': '0Aka-nSBc9znndE90QmYxNU5ZMXJkcFpCUkxranlNX3c',  // grafton
    'http://data.logainm.ie/place/1383279': '0Aka-nSBc9znndElKNTlzMlhqUDh2UktWbnFoeUJfWnc'  // moore
};

// load the map on page load
$(document).ready(function() {

    cleanupResults();

    // set the default uri
    var defaultInfo;
    if($.sessionStorage("selectedPlace")) {
        defaultInfo = $.sessionStorage("selectedPlace");
    } else  {
        defaultInfo = { uri: {'value': "http://data.logainm.ie/place/1375542"}, name: {'value': "Dublin"}, lat: {'value': 53.34712600708008}, long: {'value': -6.259448528289795 } };
        $.sessionStorage("selectedPlace", defaultInfo);
    }

    var myLatlng = new google.maps.LatLng(defaultInfo['lat'].value, defaultInfo['long'].value);
    var myOptions = {
        scrollwheel: false,
        zoom: 13,
        maxZoom: 15,
        minZoom: 9,
        center: myLatlng,
        disableDefaultUI: true,
        zoomControl: true,
        zoomControlOptions: {
            style: google.maps.ZoomControlStyle.SMALL
        },
        mapTypeId: google.maps.MapTypeId.ROADMAP
    };
    map = new google.maps.Map(document.getElementById('map-canvas'), myOptions);

    var ctaLayer = new google.maps.KmlLayer('https://apps.dri.ie/locationLODer/kml/logainm.kml');
    ctaLayer.setOptions({
        suppressInfoWindows: true, 
        preserveViewport: true,
        map: map
    });

    google.maps.event.addListener(ctaLayer, 'click', function (kmlEvent) {
        
        var res = {}
        var html = $(kmlEvent.featureData.info_window_html);

        $("tr", html).each(function () { 
            var key = $("td:nth(0)", $(this)).text(); 
            var value = $("td:nth(1)", $(this)).text(); 

            if ('name_'+$.localStorage('logainmDemoLanguage') == key) {
                res['name'] = {'value': value }
            }

            res[key] = {'value': value }
        });

        getInfo(res);
    });


    autocomplete = new google.maps.places.PlacesService(map);
    $("#sel-en select").change( gotoCounty );
    $("#sel-ga select").change( gotoCounty );

    // enable email button function
    $("#my-location-loder .scrollable-area .wrapp .btn").click(function(e) { showEmailDialog(); e.preventDefault(); });

})

function gotoCounty(data) {
    var county = $("#sel-"+$.localStorage('logainmDemoLanguage')+" option:selected");

    var countySel = county.attr('value');
    if(countySel == 0)  {
        return false;
    }

    var country;
    var admin;
    if (['1','2','8','9','11','28'].indexOf(county.attr('value')) == -1) { 
        country = 'Ireland' ;
        admin = "administrative_area_level_1";
    } else {
        country = 'UK' ;
        admin = "administrative_area_level_2";
    }

    var textEN = $("#sel-en option:nth("+countySel+")").text()

    var request = {
        query: 'County '+textEN+', '+country
    };

    autocomplete.textSearch(request, function (d) { 
        for (var place in d) {
            var is_county = d[place].types.indexOf(admin) != -1;
            if(is_county) {
                map.panTo(d[place].geometry.location); 
                map.setZoom(9);
            }
        }
    });
}

// execute the initial search only after the map has loaded
$(window).load(function(){
    setTimeout(function() {     
        var defaultInfo = $.sessionStorage('selectedPlace');
        getInfo(defaultInfo);
    }, 100);
});


// remove all previously found results
function cleanupResults() {
    initialSearch = true;
    var loadingInfo = "<p>"+Localizer.getValue("loading")+"</p>";

    $("#placenames .img-list").html(loadingInfo); 
    $("#nli .scrollable-area .wrapp ol").html("<div class='img-list'>"+loadingInfo+"</div>"); 
    $("#europeana .scrollable-area .wrapp ol").html("<div class='img-list'>"+loadingInfo+"</div>"); 
    $("#dbpedia .scrollable-area .wrapp").html("<div class='img-list'>"+loadingInfo+"</div>");
    $("#logainm >:nth-child(2)").html("<div class='img-list'>"+loadingInfo+"</div>");

    // $("#logainm >:nth-child(2)").spin();
    $("#placenames .img-list").spin('small'); 
    $("#nli .scrollable-area .wrapp ol").spin('small'); 
    $("#europeana .scrollable-area .wrapp ol").spin('small'); 
    $("#dbpedia .scrollable-area .wrapp").spin('small');

    $("#timeline-embed").html("");
    $("#ihta").addClass("hide");

}


// adds a marker to the map based on the current result and saves the marker in the global variable 'markers'
function addActiveMarker(result) {


    if (active_marker != null) {
        active_marker.setMap(null);
        active_marker == null;
    }

    var markerPos = new google.maps.LatLng(result['lat'].value, result['long'].value);
    
    // other icon http://maps.google.com/mapfiles/ms/icons/green-dot.png
    active_marker = new google.maps.Marker({
        position: markerPos,
//        icon: "http://maps.google.com/mapfiles/ms/icons/green-dot.png",
        icon: "images/placemarkers/placemarker_000.png",
        title: result['name'].value
    });

    active_marker.setMap(map);

}



// searches all the information about a placename (executed after the user selects a marker)
function getInfo(result) {

    cleanupResults();

    // save selected link in the current session
    $.sessionStorage('selectedPlace', result);

    addActiveMarker(result);


    // return the information in logainm about a place name
    var uri = '<' + result['uri'].value + '>';
    var query = 'SELECT ?name ?ga_name ?type_name ?county_name ?dbpedia ('+uri+' as ?uri) FROM <http://data.logainm.ie/> '+
        'WHERE { '+uri+' foaf:name ?name ; '+
        'foaf:name ?ga_name; a [ foaf:name ?type_name ] .'+
        'filter (lang(?ga_name) = \"ga\" && lang(?name) = \"en\" && lang(?type_name) = \"'+$.localStorage('logainmDemoLanguage')+'\") . '+
        'OPTIONAL { '+uri+' spatial:P [ a <http://data.logainm.ie/category/CON>; foaf:name ?county_name ] . '+
        'filter(lang(?county_name) = \"en\") } . '+
        'OPTIONAL { '+uri+' owl:sameAs $dbpedia . filter(regex($dbpedia, "^http://dbpedia.org*")) } . '+
        ' } LIMIT 1 '

    $.ajax({
//	url: LOGAINM_EP,
	url: WRAPPER_URL + 'queryEP/',
        data: { query: query , endpoint: LOGAINM_EP },
        dataType: 'json',
	success: function(data) {
	    if(data && data.results.bindings.length > 0) {

                cleanupResults();

                var placenameDetails = data.results.bindings[0];

                // info from Logainm
                renderLogainmContents(placenameDetails);
                
                var dbpedia_uri = placenameDetails['dbpedia'].value.replace('%2C', ',');

                // info from DBpedia
                var query = 'SELECT * FROM <http://dbpedia.org> '+
                    'where { <'+ dbpedia_uri +'> dbo:abstract $abstract . '+
                    'OPTIONAL { <'+dbpedia_uri +'> dbo:thumbnail $thumb } . '+
                    'filter(lang($abstract) = "en") . }';
                queryEP('dbpedia', DBPEDIA_EP, query);

                if(streets[placenameDetails['uri'].value]) {

                    $("#ihta > div").html("");
                    $("#ihta > div").html($("<iframe/>", { 
                        src: 'https://embed.verite.co/timeline/?source='+
                            streets[placenameDetails['uri'].value]
                            +'&font=Bevan-PotanoSans&maptype=toner&lang=en',
                        width: '100%',
                        height: '350',
                        frameborder: '0' }));
                    

                    var icon = active_marker.getIcon().replace(WRAPPER_URL, '');
                    var new_icon = icon.substr(0, 32) + '1' + icon.substr(33);
                    active_marker.setIcon(new_icon);

                    $("#ihta").removeClass('hide');

                    $("#ihta .scrollable-area").css('height', 162);
                    $("#ihta .scrollable-area").css('width', '100%');
                    $("#ihta .scrollable-area-wrapper").css('height', 162);
                    $("#ihta .scrollable-area-wrapper").css('width', '100%');
                    $("#ihta .scrollable-area-wrapper").css('overflow', 'hidden');
                }

                // info from logainm
                query = 'SELECT * FROM <http://data.logainm.ie/> '+
                    'WHERE { <'+result['uri'].value+'> <http://purl.org/dc/terms/isReferencedBy> $img }';
                queryEP('placenames', LOGAINM_EP, query);

                // info from NLI Longfield Maps
                query = result['uri'].value;
                queryEP('nli', WRAPPER_URL + 'nli/', query);

                // info from Europeana
                query = 'PREFIX dc: <http://purl.org/dc/elements/1.1/>'+
                    ' SELECT * WHERE { ?item dc:subject "' + placenameDetails['name'].value + '";'+
                    ' dc:title ?title ;'+
                    ' dc:subject "'+placenameDetails['county_name'].value+'";'+
                    ' <http://purl.org/dc/terms/spatial> "Ireland" }';
               
                queryEP('europeana', EUROPEANA_EP,  query);

            } else {
		$("<p>I didn't find information for this place name.");
            }

	},
	error:  function(msg){
	    console.log("<p>There was a problem querying 'logainm':</p><code>" + msg.statusText + "</code>");
	} 
    });
}

// show information from other sources
function queryEP(source, EP, query) {
    var endpoint;
    
    if (source == 'nli') {
        endpoint = EP;
    } else {
        endpoint = WRAPPER_URL + 'queryEP/';
    }

    $.ajax({
//	url: EP,
	url: endpoint,
        data: { query: query, endpoint: EP },
        dataType: 'json',
	success: function(data){

            if(source == "dbpedia") {
                renderDBpediaContents(data.results.bindings[0]);
            } else { 
                renderContents(source, data.results.bindings);
            }

 	},
	error:  function(msg){
	    console.log("<p>There was a problem querying '"+source+"':</p><code>" + msg.statusText + "</code>");
	} 
    });
}


function renderDBpediaContents(data) {
    
    var element = $("#dbpedia .scrollable-area .wrapp");
    element.html("");
    if(data['thumb']) {
        element.append($("<div/>", {'class': 'img'})
                       .append($("<img/>", {src: data['thumb'].value,
//                                            width: 177, height: 133, 
                                            alt: 'image description'}))
                      );
    }
    element.append($("<p/>").html(data['abstract'].value));

}

function renderLogainmContents(placenameDetails) {

    var contents = $("<dl/>", {'class': 'item-list'});

    if (placenameDetails['ga_name']) {
        contents.append($("<dt>Ainm:</dt><dd>" + placenameDetails['ga_name'].value + "</dd>"));
    }
    contents.append($("<dt>Name:</dt><dd>" + placenameDetails['name'].value + "</dd>"));

    contents.append($("<dt style='clear:left;'>"+Localizer.getValue("#logainm .holder .item-list dt:nth(2)")+"</dt><dd>" + placenameDetails['type_name'].value + "</dd>"));

    if (placenameDetails['county_name']) {
        contents.append($("<dt>"+Localizer.getValue("#logainm .holder .item-list dt:nth(3)")+"</dt><dd>" + placenameDetails['county_name'].value + "</dd>"));
    }
    
    $("#logainm >:nth-child(2)").html("").append(contents);

}


// meta-function to abstract details of each data source 
function renderContents(source, data) {

    var accessFunction;
    var renderer;
    var previewFunc;
    var element;
    var iconIndex;

    switch(source) {
        case "nli":
            accessFunction = function (d) { return { text : d.title, 
                                                     img : d.thumb, 
                                                     id: d.id,
                                                     link: 'http://catalogue.nli.ie/Record/'+d.id,
                                                     type: 'nli'
                                                   } }
            renderer = renderTextItem;
            previewFunc = previewNLI;
            iconIndex = 33;
            element = $("#nli .scrollable-area .wrapp ol");
            break;
        case "placenames":
            accessFunction = function (d) { return { text : d['img'].value.replace('https://www.logainm.ie/Iomhanna/',''), 
                                                     img : d['img'].value, 
                                                     link: d['img'].value,
                                                     type: 'placenames'
                                                   }; }
            renderer = renderImgItem;
            previewFunc = previewLogainm;
            element = $("#placenames .img-list");
            iconIndex = -1;
            break;
        case "europeana":
            accessFunction = function(d) { return { text : d['title'].value, 
                                                    img : 'images/europeana.gif', 
                                                    id: d['item'].value,
                                                    link: d['item'].value,
                                                    type: 'europeana'
                                                  }; };
            renderer = renderTextItem;
            previewFunc = previewEuropeana;
            element = $("#europeana .scrollable-area .wrapp ol");
            iconIndex = 34;
            break;
    }

    var contents = new Array();
    for (var i=0; i < data.length; i++) {
        
        var norm = accessFunction(data[i]);
        var item = renderer(norm, previewFunc);
        contents.push(item);
    }    

    // no info found
    if (contents.length == 0) {
        var emptyText =  "<p>"+Localizer.getValue("no-info")+"</p>";
        if (source != "placenames") {
            emptyText = "<div class='img-list'>" + emptyText + "</div>";
        }
        contents.push(emptyText);
    } else {
        if (iconIndex > 0) {
            var icon = active_marker.getIcon().replace(WRAPPER_URL, '');
            var new_icon = icon.substr(0, iconIndex) + '1' + icon.substr(iconIndex+1);
            active_marker.setIcon(new_icon);
        }
    }

    element.html("").append(contents);  // clear old msg and add contents
    
}


// adds a link to a source that uses img links
function renderImgItem (item, previewFunc) {
    
    var li = $("<li/>");

    var link = 
        $("<img/>", {
            src: item['img'],
            width: 91,
            height: 84
        });

    $("<a/>", {'class': 'open', href: '#'})
        .append(link)
        .appendTo(li);

    $("<div/>", {'class': 'popup1'}).append(
        $("<img/>", {
            src: item['img'],
            width: 348,
            height: 218
        })
    ).appendTo(li);

    li.click( item, function(e) { addLink(e.data.text, e.data.link, e.data.type); e.preventDefault(); });

    addPreview(li, item, previewFunc );

    return li;

}


// adds a link to a source that uses textual links
function renderTextItem (item, previewFunc) {

    var li = $("<li/>");
    
    $("<a/>", {'class': 'open', href: '#', text: item['text']}).appendTo(li)
        .click( item, function(e) { addLink(e.data.text, e.data.link, e.data.type); e.preventDefault(); });

    addPreview(li, item, previewFunc );

    return li;

}

// displays a link in the mashup preview, different renderings are done for each type
function displayLink(uri, elem, type) {
    
    var item;
    var renderer;

    switch(type) {
        case 'europeana':
        item = { link: uri };
        renderer = previewEuropeana;
        break;
        case 'nli':
        item = { id: uri.replace('http://catalogue.nli.ie/Record/','') };
        renderer = previewNLI;
        break;
        case 'placenames':
        item = { img: uri };
        renderer = previewLogainm;
        break;
    }

    // display contents in box
    $("#my-location-loder-preview").html("");

    renderer(item, $("#my-location-loder-preview"));

    $("#my-location-loder .scrollable-area .wrapp .selected").removeClass('selected');
    elem.parent().addClass('selected');

}

// adds a link (name, uri) to the mashup link area
function addLink(name, uri, type) {

    var s = $.sessionStorage('selectedPlace')
    
    // check if the place name is already included in my location loder
    var place = $("#my-location-loder .scrollable-area .wrapp h2 a[href='"+s.uri.value+"']").parent().parent();
    if (place.length == 0) {
        $("#my-location-loder .scrollable-area .wrapp").sortable();
        place = $("<div/>", {'class': 'box'})
            .append($("<h2/>")
                    .append($("<a/>", {href: s.uri.value , text: s.name.value, target: "_blank"}))
                   );

        var p = $("<ul/>");
        p.sortable();
        p.appendTo(place);
        place.prependTo($("#my-location-loder .scrollable-area .wrapp"));
    }

    // get all the links already included in my location loder
    var links = $("ul li a", place).map(function () { return $(this).attr("href") }).get();
   
    var index = links.indexOf(uri);
    var link;

    // check if link is present
    if(index == -1) {
        // otherwise insert it
        var img = $("<img/>", { src: 'images/delete.png', style: 'width:16px;height:16px;' })
            .click(function(e) { 
                var li = $(this).parent();
                var parent_ul = li.parent();
                if(li.hasClass("selected")) { $("#my-location-loder-preview").html(""); }
                li.remove(); 
                if (parent_ul.children().size() == 0) { parent_ul.parent().remove(); }
                e.preventDefault();
            });

        link = $("<li/>")
            .append("&nbsp;")
            .append(
                $("<a/>", { href: uri , 'type': type, text: name })
                    .click(function(e) { displayLink(uri, $(this), type);  e.preventDefault(); })
            )
            .prepend(img)
        $("ul", place).append(link);
    } else {
        link = $("ul > li:nth-child("+ (index+1) +")", place);
    }

    displayLink(uri, $("a", link), type);

 
}


function sendEmail() {
    var data = {
        from: $("#cname").val(),
        email: $("#cemail").val(),
        to: $("#tname").val() + ' <'+ $("#temail").val() +'>',
        subject: Localizer.getValue("email-subject"),
        contents: $("#email-contents").val() + '<br/>' + $("#email-links").html(),
        challenge: Recaptcha.get_challenge(),
        response: Recaptcha.get_response()
    }

    $.post(WRAPPER_URL + 'email/', data,
//        success: 
           function(data){ 
            Recaptcha.destroy();
    
            noty({text: 'email sent!', 
                  layout: 'center', 
                  type: 'success', 
                  modal: true, 
                  timeout: 1500, 
                  theme:'defaultTheme'});
            $( "#dialog" ).dialog( "destroy" ); 
        }).fail(
//        error: 
           function(msg){
            Recaptcha.destroy();
            Recaptcha.create("6Le8yOYSAAAAACrHr5QrZqil0V8Ie0saSOVVy4kd",
                             "reCAPTCHA"
                            );
            console.log("<p>There was a problem querying 'email':</p><code>" + msg.statusText + "</code>");
            noty({text: 'reCAPTCHA error. Please try again.', 
                  layout: 'center', 
                  type: 'error', 
                  modal: true, 
                  timeout: 1000, 
                  theme:'defaultTheme'});
            return false;
        } 
//    }
          );
    return false;
}

function showEmailDialog() {
    
    var links = $("#my-location-loder .scrollable-area .wrapp .box").clone();
    // do some clean up of the html
    $("img", links).remove();
    $("*", links).andSelf().removeAttr('class');
    $("*", links).andSelf().removeAttr('id');
    $("a[type='nli']", links).each(function() { $(this).attr('href', 'http://catalogue.nli.ie/Record/'+$(this).attr('href')); });
    $("*", links).andSelf().removeAttr('type');
    $("*", links).andSelf().removeAttr('target');

    $("#dialog #email-links").html(
        $("<span/>", { html: Localizer.getValue("email-message")})
            .append(links)
    );

    $( "#dialog" ).dialog({ draggable: false, modal: true, width: 500, height: 600 });

    Recaptcha.create("6Le8yOYSAAAAACrHr5QrZqil0V8Ie0saSOVVy4kd", "reCAPTCHA");
}


// function to display the logainm preview information
function previewLogainm (item, elem) {
    elem.append(
        $("<div/>", { 'class': 'img-holder'})
            .append($("<img/>", { src: item['img'] , height: '90%', width: '90%'}))
    );
}

// function to display the NLI preview information
function previewNLI (item, elem) {

    $.ajax({
	url: WRAPPER_URL + 'nliInfo/',
        data: { query: item['id'] },
	success: function(data){

	    if(data) {

                var img = null;
                if(data["thumb"]) {
                    
                    // <img src="images/img6.jpg" width="212" height="103" alt="image description">
                    img = $("<div/>", {'class': 'img-holder'}).height(153).width('100%');
                    img.append($("<img/>", {src: data["thumb"], width: 152, height: 153})); //.error(function(){ $(this).hide(); })

                }

                var div = $("<dl/>", {'class': 'info-list'});
                
                for (var key in data) {

                    if(key == "thumb") {
                        continue;
                    } else {
                        div.append($("<dt/>").html(key));
                        var text;
                        if (typeof(data[key]) == "object") {
                           text = data[key].join("<br/>");
                        } else {
                           text = data[key];
                        }
                        div.append($("<dd/>").html(text));//.append($("<br/>"));

                    }

//                    div.append(tr);
                }
                elem.append($("<div/>", {'class': 'holder'}).append(img).append(div));
          }
 	},
	error:  function(msg){
	    elem.append($("<div/>").html("<p>There was a problem querying 'nliInfo':</p><code>" + msg.statusText + "</code>"));
	} 
    });
}

// function to display the europeana preview information
function previewEuropeana (item, elem) {

    var query = 'PREFIX dc: <http://purl.org/dc/elements/1.1/>'+
        ' SELECT ?title ?description ?source (group_concat(?subject; separator="; ") as ?subjects) '+
        ' WHERE { <'+item['link']+'> dc:title ?title; '+
        'dc:subject ?subject ;'+
        'dc:source ?source ; '+
        'dc:description ?description '+
        '. } group by ?title ?source ?description';

    // date, description, source, subjects
    $.ajax({
//	url: EUROPEANA_EP,
	url: WRAPPER_URL + 'queryEP/',
        data: { query: query, endpoint: EUROPEANA_EP },
        dataType: 'json',
	success: function(data){

	    if(data && data.results.bindings.length > 0) {

                var div = $("<dl/>", {'class': 'info-list'});

                for (var i=0; i < data.results.bindings.length; i++) {
                    
                    for (var k=0; k< data.head.vars.length; k++) {
                        var key = data.head.vars[k];

                        div.append($("<dt/>").html(key));
                        div.append($("<dd/>").html(data.results.bindings[i][key].value));//.append($("<br/>"));
                    }
            

                }
                elem.append($("<div/>", {'class': 'holder'}).append(div));
                

//                elem.append(div);
            }

 	},
	error:  function(msg){
	    elem.append($("<div/>").html("<p>There was a problem querying 'europeana':</p><code>" + msg.statusText + "</code>"));
	} 
    });

    return false;
}




/*
 * Image preview script 
 * powered by jQuery (http://www.jquery.com)
 * 
 * written by Alen Grakalic (http://cssglobe.com)
 * 
 * for more info visit http://cssglobe.com/post/1695/easiest-tooltip-and-image-preview-using-jquery
 *
 */
 
function addPreview(elem, item, contentsFunction){	
    /* CONFIG */
    
    var xOffset = 10;
    var yOffset = 30;

    // these 2 variable determine popup's distance from the cursor
    // you might want to adjust to get the right result
  
    /* END CONFIG */
    elem.hover(function(e){
        var previewElem = $("<div/>", { id: 'preview' });
	$("body").append(previewElem);				
        contentsFunction(item, previewElem);
        previewElem.css('height', '200pt')
            .css('width', '300pt');

        previewElem.addClass('popup1');
	$("#preview")
	    .css("top",(e.pageY - xOffset) + "px")
	    .css("left",(e.pageX + yOffset) + "px")
	    .fadeIn("fast");						
    },
	       function(){
		   // this.title = this.t;	
		   $("#preview").remove();
               });	

    elem.mousemove(function(e){
	$("#preview")
	    .css("top",(e.pageY - xOffset) + "px")
	    .css("left",(e.pageX + yOffset) + "px");
    });			
};


