<head>
    <meta charset="UTF-8">
    <script src="js/d3.v7.min.js"></script>
    <script src="js/graphs/main.js"></script>
    <script src="js/graphs/animalGraph.js"></script>
    <script src="js/graphs/breederGraph.js"></script>
    <script src="js/suggest.js"></script>
    <link rel="stylesheet" href="include/menu.css">
    <link rel="stylesheet" href="include/graph.css">

    <script src="js/InfoButton.js"></script>

    <script src="DataTables/DataTables-1.12.1/js/jquery.dataTables.min.js"></script>
    <script src="DataTables/JSZip-2.5.0/jszip.min.js"></script>
    <script src="DataTables/pdfmake-0.1.36/pdfmake.min.js"></script>
    <script src="DataTables/pdfmake-0.1.36/vfs_fonts.js"></script>
    <script src="DataTables/Buttons-2.2.3/js/buttons.print.min.js"></script>
    <script src="DataTables/Buttons-2.2.3/js/dataTables.buttons.min.js"></script>
    <script src="DataTables/Buttons-2.2.3/js/buttons.html5.min.js"></script>

    <link rel="stylesheet" type="text/css" href="https://cdn.datatables.net/1.12.1/css/jquery.dataTables.min.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js"></script>

</head>

<?php
require_once 'AnimalUtils.php';

$owner_id = $_REQUEST['owner_id'] ?? '';
$breedList = $this->getBreeds($owner_id);
$status = $_GET['status'] ?? 'Koik';
$breed =($_REQUEST['breed']) ?? 'Koik';
$view = $_GET['view'] ?? 'breeder';
$depth = $_GET['depth'] ?? '2';
$reg_number = $_GET['search_animal'] ?? '';
$animal_id = !empty($_GET['search_animal']) ? getAnimalIdFromRegNr($_GET['search_animal']) : null;
$year = $_GET['year'] ?? '';

$generations = isset($_REQUEST['generations']) && is_array($_REQUEST['generations'])
        ? array_map('intval', $_REQUEST['generations'])
        : [0, 2]; // by default kuvan ainult eellased ja ühe generatsiooni järglastest

?>

<div class="sg-page">
    <h1>Sugulusgraafik</h1>

    <div class="view-switch">
        <a href="?module=AnimalGraph&owner_id=<?= htmlspecialchars($owner_id) ?>&view=breeder"
           class="view-btn <?= $view === 'breeder' ? 'active' : '' ?>">
            aretaja
        </a>
        <a href="?module=AnimalGraph&owner_id=<?= htmlspecialchars($owner_id) ?>&view=animal"
           class="view-btn <?= $view === 'animal' ? 'active' : '' ?>">
            loom
        </a>
    </div>

    <div class="sg-body">

        <div class="graph-wrapper">
            <div id="graph-loading" style="display:none;">
                <div class="graph-loading-spinner"></div>
                <div class="graph-loading-text">Laen graafikut...</div>
            </div>
            <div id="graph"></div>
        </div>

        <div class="filter-panel">
            <form method="get">
                <input type="hidden" name="module" value="AnimalGraph">
                <input type="hidden" name="owner_id" value="<?= htmlspecialchars($owner_id) ?>">
                <input type="hidden" name="view" value="<?= htmlspecialchars($view) ?>">

                <input type="hidden" id="animalId" value="<?= htmlspecialchars($animal_id) ?>">
                <input type="hidden" id="herdId" value="<?= htmlspecialchars($owner_id) ?>">

                <div class="filter-group">
                    <label for="search_animal"><?= _('Otsi looma') ?>:
                        <?php if ($view === 'breeder'): ?>
                        <button type="button" class="info-btn" style="font-size: 11px; width: 17px; height: 17px; line-height: 1;" data-toggle="tooltip" data-placement="right" title="Looma otsimisel tõstetakse esile need karjad, kus selle looma eellased ja järglased sündinud on.">
                            ?
                        </button>
                        <?php endif; ?>
                    </label>
                    <input type="text" id="search_animal" name="search_animal"
                           class="animal-suggest form-control"
                           placeholder="<?= _('Otsi...') ?>"
                           value="<?= htmlspecialchars($reg_number) ?>"
                           autocomplete="off"
                           inputmode="numeric"
                           oninput="this.value = this.value.replace(/[^0-9]/g, '')"> <!-- et ainult numbreid saaks sisestada -->
                    <div id="animal-search-alert" style="display:none; margin-top:6px; padding:8px 10px; background:#fff3cd; border:1px solid #f0ad4e; border-radius:6px; color:#7a5800; font-size:12px;"></div>

                </div>

                <div class="filter-group">
                    <label for="setStatus"><?= _('Staatus') ?>:</label>
                    <select class="form-control-sm" name="status">
                        <option value='NULL'><?= _('Kõik') ?></option>
                        <?php
                        $displayMap = [
                                5 => 'lehmik',
                                6 => 'amm',
                                7 => 'pull',
                                8 => 'tõupull',
                                9 => 'härg'
                        ];

                        foreach ($displayMap as $key => $v) {
                            if ($v) {
                                $selected = ($key == $status) ? 'selected' : '';
                                echo "<option value=\"$key\" $selected>$v</option>";
                            }
                        }
                        ?>
                    </select>
                </div>

                <div class="filter-group">
                    <label for="setBreed"><?= _('Tõug') ?>:</label>
                    <select id="setBreed" name="breed">
                        <option value='NULL'><?= _('Kõik') ?></option>
                        <?php
                        foreach ($breedList as $v) {
                            $breedVal = $v['BREED'];
                            $selected = ($breedVal == $breed) ? 'selected' : '';
                            echo "<option value=\"$breedVal\" $selected>$breedVal</option>";
                        }
                        ?>
                    </select>
                </div>
                <?php if ($view === 'animal'): ?>
                    <div class="filter-group">
                        <label style="display:flex; align-items:center; gap:6px;" for="depth"><?= _('Põlvkondi') ?>:
                            <button type="button" class="info-btn" style="font-size: 11px; width: 17px; height: 17px; line-height: 1;" data-toggle="tooltip" data-placement="right" title="See rakendub ainult järglaste põlvkondadele. Eellastest on kuvatakse ainult vanemad.">
                                ?
                            </button>
                        </label>
                        <select id="depth" name="depth">
                            <?php for ($g = 1; $g <= 6; $g++): ?>
                                <option value="<?= $g + 1 ?>" <?= (($depth) == $g + 1) ? 'selected' : '' ?>> <!-- liidan +1 kuna DB-s on salvestatud väikese nihkega, sest sinna ei saa negatiivseid arve salvestada -->
                                    <?= $g ?>
                                </option>
                            <?php endfor; ?>
                        </select>
                    </div>
                <?php endif; ?>

                <?php if ($view === 'breeder'): ?>
                    <div class="filter-group">
                        <label for="year"><?= _('Sünniaasta') ?>:
                            <button type="button" class="info-btn" style="font-size: 11px; width: 17px; height: 17px; line-height: 1;" data-toggle="tooltip" data-placement="right" title="See filter kehtib ainult antud karjas sündinud loomade kohta.">
                                ?
                            </button>
                        </label>
                        <select class="form-control-sm" name="year" id="year">
                            <option value=""><?= _('Kõik') ?></option>
                            <?php
                            $currentYear = date("Y");
                            for ($y = $currentYear; $y >= 2010; $y--):
                                $selected = ($y == $year) ? 'selected' : '';
                                ?>
                                <option value="<?= $y ?>" <?= $selected ?>><?= $y ?></option>
                            <?php endfor; ?>
                        </select>
                    </div>

                    <div class="filter-group">
                        <label><?= _('Põlvkondi') ?>:
                            <button type="button" class="info-btn" style="font-size: 11px; width: 17px; height: 17px; line-height: 1;" data-toggle="tooltip" data-placement="right" title="Kui valida 'eellased', siis kuvatakse eellastest üks põlvkond.">
                                ?
                            </button>
                        </label>
                        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                            <label class="checkbox-label" style="font-weight: normal;">
                                <input type="checkbox" name="generations[]" value="0"
                                    <?= (is_array($generations) && in_array(0, $generations)) ? 'checked' : '' ?>>
                                <?= _('eellased') ?>
                            </label>
                            <?php for ($g = 1; $g <= 6; $g++): ?>
                                <label class="checkbox-label" style="font-weight: normal;">
                                    <input type="checkbox" name="generations[]" value="<?= $g + 1 ?>"
                                        <?= (is_array($generations) && in_array($g + 1, $generations)) ? 'checked' : '' ?>>
                                    <?= $g ?>
                                </label>
                            <?php endfor; ?>
                        </div>
                    </div>
                <?php endif; ?>

                <button type="submit" class="btn btn-green"><?= _('Rakenda') ?></button>
                <?php if ($view === 'animal'): ?>
                    <div style="border-top: 1px solid var(--border); margin-top: 14px; padding-top: 5px; display: flex; gap: 6px;">
                    <button class="btn btn-green" type="button" onclick="downloadCSV(window.currentTreeData)"
                                style="flex: 1; border: 1.5px solid var(--green-dark); padding: 7px 0; border-radius: 7px; font-family: inherit; font-size: 0.82rem; font-weight: 500; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px;">
                            <i class="bi bi-filetype-csv"></i> CSV
                        </button>
                        <button class="btn btn-green" type="button" onclick="downloadXLSX(window.currentTreeData)"
                                style="flex: 1; border: 1.5px solid var(--green-dark); padding: 7px 0; border-radius: 7px; font-family: inherit; font-size: 0.82rem; font-weight: 500; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px;">
                            <i class="bi bi-file-earmark-spreadsheet"></i> XLS
                        </button>
                        <button class="btn btn-green" type="button" onclick="downloadPDF(window.currentTreeData)"
                                style="flex: 1; border: 1.5px solid var(--green-dark); padding: 7px 0; border-radius: 7px; font-family: inherit; font-size: 0.82rem; font-weight: 500; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px;">
                            <i class="bi bi-file-earmark-pdf"></i> PDF
                        </button>
                    </div>
                <?php endif; ?>

            </form>
        </div>

    </div>
</div>

<script>
    window.GRAPH = {
        view: <?= json_encode($view) ?>,
        moduleUrl: <?= json_encode("/liisu/?module=AnimalGraph&owner_id=" . ($owner_id)) ?>
    };
</script>
