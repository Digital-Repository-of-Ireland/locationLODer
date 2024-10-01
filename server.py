"""
Demo for the Linked Logainm dataset.  Uses data from the Longfield Map Collection from the National Library of Ireland,
Europeana, and Logainm's scanned records.

Based on The Authors N' Books Linked Data app (https://github.com/nunolopes/dri-workshop-ld) 
by  Michael Hausenblas, http://mhausenblas.info/#i
and Nuno Lopes, http://nunolopes.org/

Copyright (c) 2012 The Apache Software Foundation, Licensed under the Apache License, Version 2.0.

@author: Nuno Lopes, http://nunolopes.org/
@since: 2013-04-11
@status: init
"""

import sys, logging, datetime, urllib2, json, requests, urlparse
from lxml import etree
from os import curdir, sep
from BaseHTTPServer import HTTPServer, BaseHTTPRequestHandler
from SocketServer import ThreadingMixIn
import threading
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import mimetypes

# configuration
DEBUG = True
DEFAULT_PORT = 8998 
EUROPEANA_EP = 'https://sparql.europeana.eu'
DBPEDIA_EP = 'https://dbpedia.org/sparql/'
LOGAINM_EP = 'https://data.logainm.ie/sparql'
LONGFIELD_MAPS='longfield_maps/lookup.xml'

if DEBUG:
	FORMAT = '%(asctime)-0s %(levelname)s %(message)s [at line %(lineno)d]'
	logging.basicConfig(level=logging.DEBUG, format=FORMAT, datefmt='%Y-%m-%dT%I:%M:%S')
	
	# mostly interested in local logs
	requests_log = logging.getLogger("requests.packages.urllib3")
	requests_log.setLevel(logging.INFO)
	requests_log.propagate = True
else:
	FORMAT = '%(asctime)-0s %(message)s'
	logging.basicConfig(level=logging.INFO, format=FORMAT, datefmt='%Y-%m-%dT%I:%M:%S')


marc = etree.parse(LONGFIELD_MAPS)

class LinkedLogainmServer(BaseHTTPRequestHandler):

	def get_local_url(self, parsed_path):
		target_url = parsed_path.path[1:]

		if target_url.startswith('/demo/'):
			target_url = target_url[4:]
		elif target_url.startswith('locationLODer/'):
			target_url = target_url[14:]
			
		return target_url


	def do_GET(self):
		self.process()

	def do_POST(self):
		parsed_path = urlparse.urlparse(self.path)
		target_url = self.get_local_url(parsed_path)
		
 		if DEBUG: logging.debug(('-' * 30) +' TARGET URL\n%s -- %s' %(target_url, parsed_path.query))

		if target_url.startswith('email/'):
			self.email(urlparse.parse_qs(parsed_path.query))
		else:
			return


	def process(self):
		parsed_path = urlparse.urlparse(self.path)
		target_url = self.get_local_url(parsed_path)
		
 		if DEBUG: logging.debug(('-' * 30) +' TARGET URL\n%s -- %s' %(target_url, parsed_path.query))
		
		if target_url == '' or target_url == '/':
			self.serve_content('home-page.html')
		elif target_url.startswith('nli/'):
			self.getNLIResources(urllib2.unquote(urlparse.parse_qs(parsed_path.query)['query'][0]))
		elif target_url.startswith('queryEP/'):
			params = urlparse.parse_qs(parsed_path.query)
			self.execQuery(urllib2.unquote(params['endpoint'][0]), urllib2.unquote(params['query'][0]))
		elif target_url.startswith('nliInfo/'):
			self.getNLIInfo(urllib2.unquote(urlparse.parse_qs(parsed_path.query)['query'][0]))
		elif target_url.startswith('locationLODer'):
			self.serve_content('location-loder.html')
		elif target_url == 'contact':
			self.serve_content('contact.html')
		elif target_url == 'report':
			self.serve_content('report.html')
		elif target_url == 'using_linked_logainm':
			self.serve_content('using_linked_logainm.html')
		else:
			self.serve_content(target_url)

		return


	def email(self, parsed_qs):
		""""send email with links, needs controls over this"""

		length = int(self.headers['Content-Length'])
		post_data = urlparse.parse_qs(self.rfile.read(length).decode('utf-8'))

		try:
			response =  post_data['response']
		except Exception:
			self.reply(500, "Invalid reCaptcha!")
			return 

		api = 'http://www.google.com/recaptcha/api/verify'
		p = { "privatekey": "6Le8yOYSAAAAAKHbbZ1dJI7QI6sZ4jE6ogKYc_hc",
			  "remoteip": self.client_address[0],
			  "challenge": post_data['challenge'],
			  "response": response
		} 
		request = requests.get(api, params=p)

		# check if the captcha is true
		if request.text.split('\n')[0] != 'true':
			self.reply(500, "Invalid reCaptcha!")
			return 

		name = post_data['from'][0]
		email = post_data['email'][0]
		subject = unicode(post_data['subject'][0])
		to = post_data['to'][0]
		msgText = unicode(post_data['contents'][0])

		fromaddr = '%s <%s>' % (name, email)

		# Credentials (if needed)  
		username = 'linked.logainm'  
		password = 'LinkedDataLogainm'  
			
		msgHtml = """<html>
<head></head>
<body>
%s
</body>
</html>""" % msgText

		# part1 = MIMEText(msgText, 'plain')
		part1 = MIMEText('We tried to send you an HTML email!', 'plain')
		part2 = MIMEText(unicode(msgHtml), 'html', 'UTF-8')

		msg = MIMEMultipart('alternative')
		# msg = MIMEText(msgText)

		msg['Subject'] = unicode(subject)
		msg['From'] = fromaddr
		msg['To'] = to
		msg['Sender'] = 'linked.logainm@gmail.com'
		msg['Reply-To'] = email

		msg.attach(part1)
		msg.attach(part2)

		# The actual mail send  
		server = smtplib.SMTP('smtp.gmail.com:587')  
		server.starttls()  
		server.login(username, password)  
		server.sendmail(fromaddr, to, msg.as_string())  
		server.quit()  
		self.reply(200, 'Email Sent!')
			


	# serves static content from file system
	# 	def serve_content(self, p, media_type='text/html'):
 	def serve_content(self, p):
		try:
			fullpath = curdir + sep + p
			f = open(fullpath, 'rb')
			media_type = mimetypes.guess_type(fullpath)[0]
			self.reply(200, f.read(), media_type)
			f.close()
			return
		except IOError:
			self.send_error(404,'File Not Found: %s' % self.path)


	"""Retreive the Longfield Maps marc record for a specific item"""
	def getNLIInfo(self, marcID):
		results = dict()
		query = "//marc:record[./marc:controlfield[@tag='001']/text()='%s']" % marcID
		if DEBUG: logging.debug(('-' * 30) +' XPath:\n%s' %(query))
		for record in marc.xpath(query, namespaces={'marc':'http://www.loc.gov/MARC21/slim'}):
#			results['id'] = marcID
			author = (' ').join(record.xpath('.//*[@tag="100"]/*/text()'))
			if author != '':
				results['author'] = author
			else:
				results['donor'] = (' ').join(record.xpath('.//*[@tag="700"]/*/text()'))

			results['title'] = record.xpath('.//*[@tag="245"]/*[@code="a"]/text()')[0]
			results['date'] = record.xpath('.//*[@tag="260"]/*[@code="c"]/text()')[0]
			results['location'] = record.xpath('.//*[@tag="522"]/*[@code="a"]/text()')[0]

			import re, math
			intId = int(re.split('([0-9]*)', marcID)[1])
			round = int(math.ceil(intId/10000.0))
			thumb = 'http://catalogue.nli.ie/content/nli/%05d0000/%09d/thumbnail/nli%09d.jpg' % (round, intId, intId)
			try:
				img = urllib2.urlopen(thumb)
				results['thumb'] = thumb
			except:
				True
			subs = []
			for subject in record.xpath('.//*[@tag="650"]'):
				subs.append(' > '.join(subject.xpath("./*/text()")))
			results['subjects'] = subs

		if DEBUG: logging.debug(('-' * 30) +' XPath Results: %s' % len(results))
		self.reply(200, json.dumps( results ), 'application/json')
		

	"""Retreive the Longfield Maps collection items that refer to the place"""
	def getNLIResources(self, logainmEntity):
		results = []
		query = "//marc:record[.//marc:subfield/text()='%s']" % urllib2.unquote(logainmEntity)
		if DEBUG: logging.debug(('-' * 30) +' XPath:\n%s' %(query))
		for record in marc.xpath(query, namespaces={'marc':'http://www.loc.gov/MARC21/slim'}):
			r = dict()
			r['id']= record.xpath('.//*[@tag="001"]/text()')[0]
			r['title']= record.xpath('.//*[@tag="245"]/*[@code="a"]/text()')[0]
			results.append(r)

		if DEBUG: logging.debug(('-' * 30) +' GOT QUERY\n%s' %(len(results)))
		self.reply(200, json.dumps({'results': { 'bindings': results } }), 'application/json')



	""" execute the query against the provided endpoint"""
	def queryEndpoint(self, endpoint, query):

		# if DEBUG: logging.debug(('-' * 30) +' GOT QUERY\n%s' %(query))
		# query = urllib2.unquote(query)
		lower = query.lower()
		if not "limit" in lower:
			lower += " limit 10"
		if not ("select" in lower or "construct" in lower or "ask" in lower or "describe" in lower):
			return (500, 'Please provide a valid SPARQL query!')

		try:
			p = {"query": query } 
			headers = { 'Accept': 'application/sparql-results+json', 'Access-Control-Allow-Origin': '*' }
			if DEBUG: logging.debug(('-' * 30) +' Query to endpoint %s with query\n%s' %(endpoint, query))
			request = requests.get(endpoint, params=p, headers=headers)
			# if DEBUG: logging.debug('Request:\n%s' %(request.url))
			# if DEBUG: logging.debug('Result:\n%s' %(json.dumps(request.json, sort_keys=True, indent=4)))
			if DEBUG: logging.debug(('-' * 30) +' Result:\n%s' % (len(request.json())))
			return (200, request.json())
		except:
			return (500, 'Something went wrong here on the server side.')




	""" execute the query against the provided endpoint"""
	def execQuery(self, endpoint, query):
		code, result = self.queryEndpoint(endpoint, query)
		self.reply(code, json.dumps(result), 'application/json')


	# """sends the specified response code and reply"""
	def reply(self, code, body=None, type="text/plain"):
		if code >= 400:
			if body != None:
				self.send_error(code, body)
			else:
				self.send_error(code)
		else:
			self.send_response(code)
			# self.send_header("Cache-Control", "no-cache")
			# self.send_header("Access-Control-Allow-Origin", "*")
			if body != None:
				self.send_header("Content-Type", type);
				self.end_headers();
				self.wfile.write(body)


class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    """Handle requests in a separate thread."""

if __name__ == '__main__':
    server = ThreadedHTTPServer(('', DEFAULT_PORT), LinkedLogainmServer)
    print 'Starting server, use <Ctrl-C> to stop'
    server.serve_forever()
