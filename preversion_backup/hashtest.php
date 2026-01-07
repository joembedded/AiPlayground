<?php
//   http://localhost/wrk/ai/playground/sw/api/hashtest.php?password=geheimnix
declare(strict_types=1);
$userEnteredPassword = $_REQUEST['password'] ?? '';
$testhash = password_hash($userEnteredPassword, PASSWORD_DEFAULT); 
echo "PW: $userEnteredPassword  <br>  Testhash:    $testhash   <br>";

$toverify=$_REQUEST['testhash'] ?? '';
echo "Verifying against     : ' $toverify  '  Res:";
if (!password_verify($userEnteredPassword, $toverify)) echo "INVALID"; 
else echo "VALID";

exit; 

