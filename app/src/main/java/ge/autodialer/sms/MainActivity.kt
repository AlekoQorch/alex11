package ge.autodialer.sms

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.Message
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle

class MainActivity : ComponentActivity() {

    private val viewModel: AutoDialerViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                AutoDialerApp(viewModel = viewModel)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AutoDialerApp(viewModel: AutoDialerViewModel) {
    val dialerState by viewModel.dialerState.collectAsStateWithLifecycle()
    var numbersText by remember { mutableStateOf("") }
    var selectedTemplateId by remember { mutableIntStateOf(viewModel.smsTemplates.first().id) }
    var smsTargetNumber by remember { mutableStateOf("") }

    val permissions = arrayOf(
        Manifest.permission.CALL_PHONE,
        Manifest.permission.READ_PHONE_STATE,
        Manifest.permission.SEND_SMS
    )

    var permissionsGranted by remember {
        mutableStateOf(false)
    }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { results ->
        permissionsGranted = results.values.all { it }
        if (!permissionsGranted) {
            Toast.makeText(
                androidx.compose.ui.platform.LocalContext.current,
                "ნებართვები საჭიროა აპის სამუშაოსთვის",
                Toast.LENGTH_LONG
            ).show()
        }
    }

    val defaultDialerLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { /* role result handled on next recomposition */ }

    val context = androidx.compose.ui.platform.LocalContext.current
    androidx.compose.runtime.LaunchedEffect(Unit) {
        permissionsGranted = permissions.all {
            ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED
        }
        if (!permissionsGranted) {
            permissionLauncher.launch(permissions)
        }
    }

    val isRunning = dialerState.status == DialerStatus.DIALING ||
        dialerState.status == DialerStatus.RINGING ||
        dialerState.status == DialerStatus.ANSWERED

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("ავტოდაილერი + SMS") },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color(0xFF1565C0),
                    titleContentColor = Color.White
                ),
                actions = {
                    Icon(
                        Icons.Default.Settings,
                        contentDescription = "პარამეტრები",
                        tint = Color.White,
                        modifier = Modifier
                            .padding(end = 16.dp)
                            .clickable {
                                if (!viewModel.isDefaultDialer()) {
                                    viewModel.createDefaultDialerIntent()?.let {
                                        defaultDialerLauncher.launch(it)
                                    }
                                } else {
                                    context.startActivity(viewModel.createAccessibilitySettingsIntent())
                                }
                            }
                    )
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            if (!viewModel.isDefaultDialer()) {
                SetupHintCard(
                    title = "რჩევა: დააყენეთ ნაგულისხმევი აპი",
                    message = "30 წამში ავტომატური გათიშვისთვის, დააყენეთ ეს აპი ნაგულისხმევ დაილერად (⚙ ზემოთ). ასევე ჩართეთ Accessibility სერვისი."
                )
            }

            SectionTitle("📞 ნომრების სია")
            OutlinedTextField(
                value = numbersText,
                onValueChange = {
                    numbersText = it
                    viewModel.updateNumbersFromText(it)
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(140.dp),
                placeholder = { Text("ჩაწერეთ ან ჩასვით ნომრები\n(თითო ხაზზე ერთი, ან მძიმით გამოყოფილი)\n\nმაგ: 555123456\n599123456") },
                enabled = !isRunning
            )

            val parsedCount = PhoneNumberParser.parse(numbersText).size
            Text(
                text = "ნაპოვნი ნომრები: $parsedCount",
                color = Color.Gray,
                fontSize = 13.sp
            )

            StatusCard(dialerState)

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Button(
                    onClick = {
                        if (!permissionsGranted) {
                            permissionLauncher.launch(permissions)
                            return@Button
                        }
                        smsTargetNumber = PhoneNumberParser.parse(numbersText).firstOrNull().orEmpty()
                        viewModel.startAutoDial(numbersText)
                    },
                    modifier = Modifier.weight(1f),
                    enabled = !isRunning && parsedCount > 0,
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2E7D32))
                ) {
                    Icon(Icons.Default.PlayArrow, contentDescription = null)
                    Spacer(Modifier.width(4.dp))
                    Text("დაწყება")
                }

                OutlinedButton(
                    onClick = { viewModel.stopAutoDial() },
                    modifier = Modifier.weight(1f),
                    enabled = isRunning
                ) {
                    Icon(Icons.Default.Stop, contentDescription = null, tint = Color.Red)
                    Spacer(Modifier.width(4.dp))
                    Text("გაჩერება", color = Color.Red)
                }
            }

            SectionTitle("💬 SMS შაბლონები")

            OutlinedTextField(
                value = smsTargetNumber,
                onValueChange = { smsTargetNumber = it },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("SMS-ის მიმღები ნომერი") },
                placeholder = { Text("599123456") },
                singleLine = true
            )

            viewModel.smsTemplates.forEach { template ->
                SmsTemplateCard(
                    template = template,
                    selected = selectedTemplateId == template.id,
                    onSelect = { selectedTemplateId = template.id },
                    onSend = {
                        if (!permissionsGranted) {
                            permissionLauncher.launch(permissions)
                            return@SmsTemplateCard
                        }
                        val target = smsTargetNumber.ifBlank {
                            dialerState.currentNumber ?: PhoneNumberParser.parse(numbersText).firstOrNull().orEmpty()
                        }
                        if (target.isBlank()) {
                            Toast.makeText(context, "მიუთითეთ ნომერი SMS-ისთვის", Toast.LENGTH_SHORT).show()
                        } else {
                            viewModel.sendSms(target, template)
                        }
                    }
                )
            }

            Spacer(Modifier.height(32.dp))
        }
    }
}

@Composable
private fun SectionTitle(text: String) {
    Text(
        text = text,
        fontWeight = FontWeight.Bold,
        fontSize = 18.sp,
        color = Color(0xFF1565C0)
    )
}

@Composable
private fun SetupHintCard(title: String, message: String) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color(0xFFFFF3E0)),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(Modifier.padding(12.dp)) {
            Text(title, fontWeight = FontWeight.Bold, color = Color(0xFFE65100))
            Spacer(Modifier.height(4.dp))
            Text(message, fontSize = 13.sp, color = Color(0xFF5D4037))
        }
    }
}

@Composable
private fun StatusCard(state: AutoDialerState) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color(0xFFE3F2FD)),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (state.status == DialerStatus.DIALING || state.status == DialerStatus.RINGING) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        strokeWidth = 2.dp,
                        color = Color(0xFF1565C0)
                    )
                    Spacer(Modifier.width(8.dp))
                } else {
                    Icon(Icons.Default.Call, contentDescription = null, tint = Color(0xFF1565C0))
                    Spacer(Modifier.width(8.dp))
                }
                Text(state.statusMessage, fontWeight = FontWeight.Medium)
            }

            if (state.status == DialerStatus.DIALING || state.status == DialerStatus.RINGING) {
                Spacer(Modifier.height(12.dp))
                LinearProgressIndicator(
                    progress = { state.secondsRemaining / 30f },
                    modifier = Modifier.fillMaxWidth(),
                    color = Color(0xFF1565C0),
                    trackColor = Color(0xFFBBDEFB)
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    "დარჩენილია: ${state.secondsRemaining} წმ",
                    fontSize = 12.sp,
                    color = Color.Gray
                )
            }

            state.lastResult?.let {
                Spacer(Modifier.height(8.dp))
                Text(it, fontSize = 13.sp, color = Color(0xFF37474F))
            }

            if (state.numbers.isNotEmpty()) {
                Spacer(Modifier.height(4.dp))
                Text(
                    "პროგრესი: ${state.completedCount}/${state.numbers.size}",
                    fontSize = 12.sp,
                    color = Color.Gray
                )
            }
        }
    }
}

@Composable
private fun SmsTemplateCard(
    template: SmsTemplate,
    selected: Boolean,
    onSelect: () -> Unit,
    onSend: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onSelect() }
            .then(
                if (selected) Modifier.border(2.dp, Color(0xFF1565C0), RoundedCornerShape(12.dp))
                else Modifier
            ),
        shape = RoundedCornerShape(12.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                RadioButton(selected = selected, onClick = onSelect)
                Text(template.title, fontWeight = FontWeight.Bold)
            }
            Text(
                template.message,
                fontSize = 13.sp,
                color = Color.Gray,
                modifier = Modifier.padding(start = 48.dp, bottom = 8.dp)
            )
            Button(
                onClick = onSend,
                modifier = Modifier.align(Alignment.End),
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1565C0))
            ) {
                Icon(Icons.Default.Message, contentDescription = null)
                Spacer(Modifier.width(4.dp))
                Text("გაგზავნა")
            }
        }
    }
}
