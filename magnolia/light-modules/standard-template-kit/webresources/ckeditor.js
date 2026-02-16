CKEDITOR.editorConfig = function( config ) {

    config.removePlugins = 'resize';
    config.resize_enabled = false;
    config.removePlugins = 'elementspath';

    config.fontSize_sizes = '8/8px;9/9px;10/10px;11/11px;12/12px;13/13px;14/14px;15/15px;16/16px;18/18px;20/20px;22/22px;24/24px;26/26px;28/28px;36/36px;48/48px;72/72px';

    config.stylesSet = [
        { name: 'ZFPrometeoLight', element: 'p', styles: { 'font-family': 'ZFPrometeoLight, sans-serif' } },
        { name: 'ZFPrometeoMedium', element: 'p', styles: { 'font-family': 'ZFPrometeoMedium, sans-serif' } },
        { name: 'ZFPrometeoBold', element: 'p', styles: { 'font-family': 'ZFPrometeoBold, sans-serif' } },
        { name: 'ZFPrometeoThin', element: 'p', styles: { 'font-family': 'ZFPrometeoThin, sans-serif' } },
        { name: 'ZFSansLight', element: 'p', styles: { 'font-family': 'ZFSansLight, sans-serif' } },
		{ name: 'ZFSansMedium', element: 'p', styles: { 'font-family': 'ZFSansMedium, sans-serif' } },
        { name: 'ZFSansBold', element: 'p', styles: { 'font-family': 'ZFSansBold, sans-serif' } },
        { name: 'ZFPrometeoLight inline', element: 'span', styles: { 'font-family': 'ZFPrometeoLight, sans-serif' } },
        { name: 'ZFPrometeoMedium inline', element: 'span', styles: { 'font-family': 'ZFPrometeoMedium, sans-serif' } },
		{ name: 'ZFPrometeoBold inline', element: 'span', styles: { 'font-family': 'AFDZFPrometeoBoldiwaExtraLight, sans-serif' } },
        { name: 'ZFPrometeoThin inline', element: 'span', styles: { 'font-family': 'ZFPrometeoThin, sans-serif' } },
		{ name: 'ZFSansLight inline', element: 'span', styles: { 'font-family': 'ZFSansLight, sans-serif' } },
        { name: 'ZFSansMedium inline', element: 'span', styles: { 'font-family': 'ZFSansMedium, sans-serif' } },
		{ name: 'ZFSansBold inline', element: 'span', styles: { 'font-family': 'ZFSansBold, sans-serif' } },
    ];
    
	config.toolbarGroups = [
		{ name: 'document', groups: [ 'mode', 'document', 'doctools' ] },
		{ name: 'clipboard', groups: [ 'clipboard', 'undo' ] },
		{ name: 'editing', groups: [ 'find', 'selection', 'spellchecker', 'editing' ] },
		{ name: 'forms', groups: [ 'forms' ] },
		{ name: 'basicstyles', groups: [ 'basicstyles', 'cleanup' ] },
		'/',
		{ name: 'paragraph', groups: [ 'list', 'indent', 'blocks', 'align', 'bidi', 'paragraph' ] },
		{ name: 'links', groups: [ 'links' ] },
		{ name: 'insert', groups: [ 'insert' ] },
		'/',
		{ name: 'styles', groups: [ 'styles' ] },
		{ name: 'colors', groups: [ 'colors' ] },
		{ name: 'tools', groups: [ 'tools' ] },
		{ name: 'others', groups: [ 'others' ] },
		{ name: 'about', groups: [ 'about' ] },
        { name: 'customfont' }
	];

	config.removeButtons = 'Save,ExportPdf,NewPage,Preview,Print,Templates,Find,Replace,Scayt,Form,Checkbox,Radio,TextField,Textarea,Select,Button,ImageButton,HiddenField,CopyFormatting,RemoveFormat,CreateDiv,Blockquote,BidiLtr,BidiRtl,Language,Image,Flash,PageBreak,Iframe,About,ShowBlocks,Maximize';
};