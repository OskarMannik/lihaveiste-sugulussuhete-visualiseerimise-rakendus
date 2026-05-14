<?php
require_once('OwnerModule.php');
require_once('AnimalUtils.php');

class AnimalGraphModule extends OwnerModule {

    var $title = "Sugulusgraafik";


    /**
     * Käivitab AnimalGraph mooduli, kui päringus on action parameeter läheb edasi handleAction() funktsiooni
     * @return void
     */
    function run()
    {

        $action = $_GET['action'] ?? '';
        if ($action !== '') {
            $this->handleAction($action);
        }

        parent::run();
    }

    /**
     * Suunab eesliideselt tulnud päringu õigele meetodile vastavalt action-i väärtusele
     * @param string $action
     * @return void
     */
    private function handleAction(string $action)
    {
        try {
            switch ($action) {

                case 'getAnimalGraph': // loomavaate päring
                    $animalId = (int)($_GET['animal_id'] ?? 0);
                    $depth = (int)($_GET['depth'] ?? 1);

                    if ($animalId <= 0 || $depth <= 0) {
                        $this->jsonResponse([
                            'ok' => false,
                            'error' => 'Vigased parameetrid'
                        ], 400);
                    }

                    $data = $this->getAnimalGraph($animalId, $depth);

                    $this->jsonResponse([
                        'ok' => true,
                        'data' => $data
                    ]);
                    break;

                case 'getBreederGraph': // aretajavaate päring
                    $herdId = (int)($_GET['herd_id'] ?? 0);
                    $owner= $_REQUEST['owner_id'];

                    if ($herdId <= 0) {
                        $this->jsonResponse([
                            'ok' => false,
                            'error' => 'Vigane karja id'
                        ], 400);
                    }

                    $data = $this->getBreederGraph($owner);

                    $this->jsonResponse([
                        'ok' => true,
                        'data' => $data
                    ]);
                    break;

                case 'getHerdAnimals': //aretajavaate loomade nimekirja päring
                    $herdId       = $_GET['herd_id'];
                    $sourceHerdId = $_GET['source_herd_id'];

                    $data = $this->getHerdAnimals($herdId, $sourceHerdId);

                    $this->jsonResponse([
                        'ok' => true,
                        'data' => $data
                    ]);
                    break;

                case 'getAnimalConnectionHerds': //aretajavaate esiletõstetud karjade päring
                    $animalId = (int)($_GET['animal_id'] ?? 0);

                    $data = $this->getAnimalConnectionHerds($animalId);

                    $this->jsonResponse([
                        'ok'   => true,
                        'data' => $data
                    ]);
                    break;

                default:
                    $this->jsonResponse([
                        'ok' => false,
                        'error' => 'Tundmatu päring'
                    ], 404);
            }

        } catch (Throwable $e) {
            $this->jsonResponse([
                'ok'    => false,
                'error' => 'Serveri viga'
            ], 500);
        }
    }

    /**
     * Väljastab JSONi kasutajaliidesele saatmiseks ja peatab tagaliidese töö.
     */
    private function jsonResponse(array $payload, int $status = 200)
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($payload, JSON_UNESCAPED_UNICODE);
        exit;
    }

    /**
     * Loomavaate peamise päringu teostamine andmebaasis. Lisaks iga looma üksikasjalikumate andmete pärimine.
     * @param int $animalId
     * @param int $depth
     * @return mixed
     */
    public function getAnimalGraph(int $animalId, int $depth)
    {
        $status = $_REQUEST['status'];
        $breed = $_REQUEST['breed'];

        $result = dbGetAll("", array('animal_id' => $animalId, 'depth' => $depth, 'status' => $status, 'breed' => $breed));

        foreach ($result as &$row) { // üksikasjalikumad andmed looma kohta
            $extra_info = dbGetRow("", array('animal_id' => $row['ANIMAL_ID']));

            $row['BIRTHDAY'] = $extra_info['BIRTHDAY'];
            $row['BREED']    = $extra_info['BREED'];
            $row['STATUS']   = $extra_info['STATUS'];
            $row['NAME']     = $extra_info['NAME'];
            $row['END_OF_AR']     = $extra_info['END_OF_AR'];
            $row['INBR']     = $extra_info['INBR'];
        }
        return $result;

    }

    /**
     * Aretajavaate peamise päringu teostamine andmebaasis.
     * @param int $herdId
     * @return mixed
     */
    public function getBreederGraph(int $herdId)
    {
        $status = $_REQUEST['status'];
        $breed = $_REQUEST['breed'];
        $year = $_REQUEST['year'];

        $generations = isset($_REQUEST['generations']) && is_array($_REQUEST['generations'])
            ? $_REQUEST['generations']
            : [0, 2]; // by default kuvatakse vanemad ja järglastest üks põlvkond

        $gen_filter = '';
        if (!empty($generations)) { // põlvkondade filter
            $gen_list = implode(',', array_map('intval', $generations));
            $gen_filter = "WHERE pedigree_level IN ($gen_list)";
        }

        $parents_filter = in_array(0, $generations) || empty($generations);
        $max_depth = !empty($generations) ? max(array_map('intval', $generations)) : 2; // optimiseerimiseks otsime loomi ainult max valitud põlvkonnani ja mitte rohkem

        return dbGetAll(
        ($parents_filter ? "", array('herd_id' => $herdId, 'status' => $status, 'breed' => $breed, 'year' => $year));
    }

    /**
     * Aretajavaate loomade nimekirja päringu teostamine andmebaasis.
     * @param int $herdId
     * @param int $sourceHerdId
     * @return mixed
     */
    public function getHerdAnimals(int $herdId, int $sourceHerdId)
    {
        $status       = $_GET['status'];
        $breed        = $_GET['breed'];
        $year         = $_GET['year'];

        return dbGetAll("", array('herd_id' => $herdId, 'source_herd_id' => $sourceHerdId, 'status' => $status, 'breed' => $breed, 'year' => $year));
    }


    /**
     * Aretajavaate karjade esiletõstmise päringu teostamine andmebaasis.
     * @param int $animalId
     * @return mixed
     */
    public function getAnimalConnectionHerds(int $animalId){
        return dbGetAll("", array('animal_id' => $animalId));
    }


    /**
     * Funktsioon, mis tagastab omaniku karjas olevad loomade tõud, et filtris ainult neid kuvada.
     * @param string $owner_id
     * @return mixed
     */
    public function getBreeds(string $owner_id)
    {
        return dbGetAll("", array('owner_id'=>$owner_id));

    }


}
