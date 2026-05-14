$(function () { // info nupu jaoks eraldi taaskasutatav fail
    $('[data-toggle="tooltip"]').tooltip({
        trigger: 'hover'
    });

    document.querySelectorAll('.no-click').forEach(button => {
        button.addEventListener('click', function (e) {
            e.preventDefault();
            this.blur();
        });
    });
});
