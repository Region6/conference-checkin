var fs = require("fs"),
    path  = require('path'),
    pdfjs = require('pdfjs'),
    notoSansRegular = fs.readFileSync(path.join(__dirname, '/vendors/fonts/NotoSans-Regular.ttf')),
    notoSansBold = fs.readFileSync(path.join(__dirname, '/vendors/fonts/NotoSans-Bold.ttf')),
    font = {
      notosans: {
        regular: pdfjs.createTTFFont(notoSansRegular),
        bold:    pdfjs.createTTFFont(notoSansBold)
      }
    },
    doc = pdfjs.createDocument({
      font:      font.notosans.regular,
      width: 612,
      height: 792,
      padding:   10,
      threshold: 20
    }),
    lorem = {
      long:  'Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet. Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet. Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet.\n\n\nDuis autem vel eum iriure dolor in hendrerit in vulputate velit esse molestie consequat, vel illum dolore eu feugiat nulla facilisis at vero eros et accumsan et iusto odio dignissim qui blandit praesent luptatum zzril delenit augue duis dolore te feugait nulla facilisi. Lorem ipsum dolor sit amet, consectetuer adipiscing elit, sed diam nonummy nibh euismod tincidunt ut laoreet dolore magna aliquam erat volutpat.\n\n\nUt wisi enim ad minim veniam, quis nostrud exerci tation ullamcorper suscipit lobortis nisl ut aliquip ex ea commodo consequat. Duis autem vel eum iriure dolor in hendrerit in vulputate velit esse molestie consequat, vel illum dolore eu feugiat nulla facilisis at vero eros et accumsan et iusto odio dignissim qui blandit praesent luptatum zzril delenit augue duis dolore te feugait nulla facilisi.',
      short: 'Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet. Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet.'
      };

var text;

function header() {
  var header = doc.header(),
      table, tr, td;
  table = header.table({ widths: ['50%', '50%']});
  tr = table.tr({borderBottomWidth: 4});
  tr.td('Invoice', { font: font.notosans.bold, fontSize: 20 });
  tr.td('MG2015-34', { font: font.notosans.bold, textAlign: 'right', fontSize: 20 });
}

function payTo() {
  var table, tr, td1, td2;
  table = doc.table({ widths: ['60%', '40%']});
  tr = table.tr();
  td1 = tr.td();
  td1.text("Billed to:");
  td1.text("FirstName LastName");
  td1.text("4002 Rehel Drive");
  td1.text("College Station, TX 77845");

  td2 = tr.td();
  td2.text("Payment Method:");
  td2.text("Type: ");
  td2.text("Card Number: e");
  td2.text("Transaction ID: ");
  td2.text("Date: ");
}

function lineItems() {
  var table, tr, td;
  table = doc.table({ headerRows: 1, widths: ['15%', '45%', '15%', '25%']});
  tr = table.tr({borderBottomWidth: 1});
  tr.td('Item', { font: font.notosans.bold, fontSize: 12 });
  tr.td('Description', { font: font.notosans.bold, fontSize: 12 });
  tr.td('Quantity', { font: font.notosans.bold, fontSize: 12 });
  tr.td('Price', { font: font.notosans.bold, fontSize: 12 });

  tr = table.tr();
  tr.td('G17', {});
  tr.td('Conference Registration', {});
  tr.td('1', {});
  tr.td('635.00', {});
}

function finish() {
  var pdf = doc.render();
  fs.writeFile('test.pdf', pdf.toString(), 'binary');
}

header();
payTo();
text = doc.text();
text.br();
lineItems();
finish();
